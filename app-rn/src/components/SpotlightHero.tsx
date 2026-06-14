import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import YouTubePlayer, { YouTubePlayerRef } from './YouTubePlayer';
import ArtworkImage from './ArtworkImage';
import { useSpotlightStore } from '../stores/spotlightStore';
import { usePlayerStore } from '../stores/playerStore';
import { wordApi } from '../api/wordApi';
import { deckApi } from '../api/deckApi';
import { StudyUnit } from '../types/song';
import { AddWordRequest } from '../types/word';
import { getPosSpotlightColor } from '../types/pos';
import { Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MUTE_KEY = 'spotlight_muted';
const LYRIC_ANIM_MS = 300;
const LYRIC_SLIDE = 18;

// The POS that are checked by default in the word-list bottom sheet
// (WordListSheet.DEFAULT_ON_POS). "단어장 만들기" picks exactly these words so the
// auto-created deck matches what the user would get by accepting the sheet's defaults.
const DEFAULT_ON_POS = new Set(['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB']);

// Build the default-checked word set from study data: default-on POS only, with a
// Korean meaning, unique by base form — same rules the bottom sheet applies.
function buildDefaultWords(studyUnits: StudyUnit[], songId: number): AddWordRequest[] {
  const map = new Map<string, AddWordRequest>();
  for (const unit of studyUnits) {
    for (const token of unit.tokens) {
      if (!DEFAULT_ON_POS.has(token.partOfSpeech)) continue;
      if (token.koreanText == null) continue;
      if (map.has(token.baseForm)) continue;
      map.set(token.baseForm, {
        japanese: token.baseForm,
        reading: token.baseFormReading ?? token.reading ?? '',
        koreanText: token.koreanText,
        partOfSpeech: token.partOfSpeech,
        songId,
        lyricLine: unit.originalText,
        koreanLyricLine: unit.koreanLyrics ?? undefined,
      });
    }
  }
  return Array.from(map.values());
}

const YOUTUBE_ID_RE = /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
function extractVideoId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(YOUTUBE_ID_RE);
  return m ? m[1] : null;
}

// Split a study unit's JP line into per-token runs, coloring only the 5
// content parts of speech. Untokenized gaps render white so the full line
// text is always present even when tokens don't cover every character.
function buildRuns(unit: StudyUnit): { text: string; color: string }[] {
  const text = unit.originalText;
  const runs: { text: string; color: string }[] = [];
  let cursor = 0;
  for (const token of unit.tokens) {
    if (token.charStart > cursor) {
      runs.push({ text: text.slice(cursor, token.charStart), color: '#FFFFFF' });
    }
    runs.push({
      text: text.slice(token.charStart, token.charEnd),
      color: getPosSpotlightColor(token.partOfSpeech),
    });
    cursor = token.charEnd;
  }
  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), color: '#FFFFFF' });
  }
  return runs;
}

interface LyricLineViewProps {
  unit: StudyUnit;
}

// One visible lyric line: colored JP runs + Korean translation underneath.
const LyricLineView = React.memo(function LyricLineView({ unit }: LyricLineViewProps) {
  const runs = useMemo(() => buildRuns(unit), [unit]);
  return (
    <View style={styles.lyricQuote}>
      <Text style={styles.jpLine}>
        {runs.map((run, i) => (
          <Text key={i} style={{ color: run.color }}>
            {run.text}
          </Text>
        ))}
      </Text>
      {unit.koreanLyrics ? (
        <Text style={styles.krLine}>{unit.koreanLyrics}</Text>
      ) : null}
    </View>
  );
});

function SpotlightHero() {
  const navigation = useNavigation<Nav>();
  const { status, data, load } = useSpotlightStore(
    useShallow(s => ({ status: s.status, data: s.data, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);

  const playerRef = useRef<YouTubePlayerRef>(null);
  const isFocusedRef = useRef(false);
  const [muted, setMuted] = useState(true);
  // "단어장 만들기" lifecycle: idle → creating (batch-add words) → created ("학습 N").
  const [deckState, setDeckState] = useState<'idle' | 'creating' | 'created'>('idle');
  const [learnCount, setLearnCount] = useState(0);
  const [createdDeckId, setCreatedDeckId] = useState<number | null>(null);
  // currentMs tracked locally — the hero MV is independent of the global
  // PlayerScreen, so we drive the synced line from onTimeChange.
  const [currentMs, setCurrentMs] = useState(0);

  const song = data?.song ?? null;
  const studyUnits = data?.studyUnits ?? [];
  const youtubeUrl = data?.youtubeUrl ?? null;
  const videoId = useMemo(() => extractVideoId(youtubeUrl), [youtubeUrl]);
  const isSynced = song?.lyricType === 'SYNCED';

  const defaultWords = useMemo(
    () => (song ? buildDefaultWords(studyUnits, song.id) : []),
    [studyUnits, song],
  );

  // Reset the create-deck state whenever the spotlighted song changes, so a
  // freshly surfaced song starts at "단어장 만들기" rather than a stale "학습 N".
  useEffect(() => {
    setDeckState('idle');
    setLearnCount(0);
    setCreatedDeckId(null);
  }, [song?.id]);

  // Load spotlight + due count, and keep the MV playing whenever Home is focused.
  // We intentionally do NOT pause on blur: react-native-screens may detach the
  // inactive tab's WebView (which pauses it on its own), and a single play() on
  // return races that re-attach. Instead we resume on focus AND re-resume from
  // handleStateChange whenever the player reports it got paused while focused.
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      load();
      playerRef.current?.play();
      return () => {
        isFocusedRef.current = false;
      };
    }, [load]),
  );

  // The hero MV should always be playing while Home is focused. If the platform
  // paused it (tab detach / visibility change), resume as soon as it reports a
  // non-playing state. A ready player resolves to 'playing' so this never loops;
  // a not-yet-attached player no-ops until its next state event.
  const handleStateChange = useCallback((state: string) => {
    if (
      isFocusedRef.current &&
      (state === 'paused' || state === 'cued' || state === 'unstarted')
    ) {
      playerRef.current?.play();
    }
  }, []);

  // Restore persisted mute preference (default muted).
  useEffect(() => {
    SecureStore.getItemAsync(MUTE_KEY)
      .then(v => {
        if (v === 'false') setMuted(false);
      })
      .catch(() => {});
  }, []);

  // Current synced line index from local playback time; PLAIN songs stay on 0.
  const currentIndex = useMemo(() => {
    if (!isSynced || studyUnits.length === 0) return 0;
    return studyUnits.reduce((acc, unit, idx) => {
      if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
      return acc;
    }, 0);
  }, [isSynced, studyUnits, currentMs]);

  const safeIndex = Math.max(0, Math.min(studyUnits.length - 1, currentIndex));
  const currentUnit = studyUnits[safeIndex] ?? null;

  // Lyric transition: as the line changes, the outgoing line slides up + fades
  // out while the incoming line slides up from below + fades in. We render the
  // "displayed" unit and swap it once the exit animation completes.
  const [displayedIndex, setDisplayedIndex] = useState(safeIndex);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const commitIndex = useCallback((idx: number) => {
    setDisplayedIndex(idx);
  }, []);

  useEffect(() => {
    if (safeIndex === displayedIndex) return;
    const target = safeIndex;
    // Exit: slide up + fade out, then swap content and enter from below.
    opacity.value = withTiming(0, { duration: LYRIC_ANIM_MS / 2, easing: Easing.in(Easing.cubic) });
    translateY.value = withTiming(
      -LYRIC_SLIDE,
      { duration: LYRIC_ANIM_MS / 2, easing: Easing.in(Easing.cubic) },
      finished => {
        if (!finished) return;
        runOnJS(commitIndex)(target);
        translateY.value = LYRIC_SLIDE;
        opacity.value = 0;
        translateY.value = withTiming(0, { duration: LYRIC_ANIM_MS / 2, easing: Easing.out(Easing.cubic) });
        opacity.value = withTiming(1, { duration: LYRIC_ANIM_MS / 2, easing: Easing.out(Easing.cubic) });
      },
    );
  }, [safeIndex, displayedIndex, translateY, opacity, commitIndex]);

  const lyricAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleTimeChange = useCallback((seconds: number) => {
    setCurrentMs(Math.round(seconds * 1000));
  }, []);

  const goToPlayer = useCallback(async () => {
    if (!song) return;
    await loadById(song.id);
    const state = usePlayerStore.getState();
    if (state.status === 'success') {
      navigation.navigate('Player', { origin: 'Home' });
    }
  }, [song, loadById, navigation]);

  // Create a deck from the song's default-checked words, then surface "학습 N".
  const handleCreateDeck = useCallback(async (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (!song || defaultWords.length === 0 || deckState !== 'idle') return;
    setDeckState('creating');
    try {
      await wordApi.batchAddWords({ words: defaultWords });
      // The deck is created synchronously via the after-commit flashcard event,
      // so it exists by the time the batch call returns.
      const deck = await deckApi.getDeckBySongId(song.id);
      setCreatedDeckId(deck?.deckId ?? null);
      setLearnCount(deck?.dueCount ?? defaultWords.length);
      setDeckState('created');
    } catch {
      setDeckState('idle');
    }
  }, [song, defaultWords, deckState]);

  const goToStudy = useCallback((e: GestureResponderEvent) => {
    e.stopPropagation();
    navigation.navigate('Review', createdDeckId != null ? { deckId: createdDeckId } : {});
  }, [navigation, createdDeckId]);

  const toggleMute = useCallback((e: GestureResponderEvent) => {
    e.stopPropagation();
    setMuted(prev => {
      const next = !prev;
      if (next) playerRef.current?.mute();
      else playerRef.current?.unMute();
      SecureStore.setItemAsync(MUTE_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  const displayedUnit = studyUnits[displayedIndex] ?? currentUnit;

  if (status === 'empty' || status === 'error' || status === 'idle' || !song) {
    return null;
  }

  return (
    <Pressable onPress={goToPlayer}>
      <View style={styles.hero}>
        {/* Background layer: MV or album image, then BlurView, then scrim. */}
        <View style={styles.bgLayer} pointerEvents="none">
          {videoId ? (
            // MV path: player fills the slot; BlurView sits on top.
            // On Android the BlurView may not visually blur the WebView — the
            // scrim still darkens it for legibility.
            <>
              <YouTubePlayer
                ref={playerRef}
                videoId={videoId}
                height={300}
                autoplay
                muted={muted}
                onTimeChange={handleTimeChange}
                onStateChange={handleStateChange}
              />
              <BlurView
                intensity={60}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            // No-video path: full-bleed album art + BlurView (blurs reliably on both platforms).
            <>
              {song?.artworkUrl ? (
                <Image
                  source={{ uri: song.artworkUrl }}
                  style={styles.bgImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.bgFallback} />
              )}
              <BlurView
                intensity={60}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
            </>
          )}
        </View>
        {/* Scrim gradient: #00000070 → #0000001F@45% → #000000C7 */}
        <View style={styles.scrim} pointerEvents="none" />

        {/* Song info */}
        <View style={styles.songInfo}>
          <ArtworkImage url={song.artworkUrl} size={46} cornerRadius={9} />
          <View style={styles.sInfoCol}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
        </View>

        {/* Synced / static lyric (1 line) */}
        {displayedUnit ? (
          <Animated.View style={lyricAnimStyle}>
            <LyricLineView unit={displayedUnit} />
          </Animated.View>
        ) : (
          <View style={styles.lyricQuote} />
        )}

        {/* CTAs */}
        <View style={styles.ctaRow}>
          <Pressable style={styles.cta} onPress={goToPlayer}>
            <Feather name="play" size={17} color="#FFFFFF" />
            <Text style={styles.ctaLabel}>이어듣기</Text>
          </Pressable>
          {deckState === 'created' ? (
            <Pressable style={styles.cta} onPress={goToStudy}>
              <Feather name="zap" size={17} color="#FFFFFF" />
              <Text style={styles.ctaLabel}>학습 {learnCount}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.cta,
                (deckState === 'creating' || defaultWords.length === 0) && styles.ctaDisabled,
              ]}
              onPress={handleCreateDeck}
              disabled={deckState === 'creating' || defaultWords.length === 0}
            >
              {deckState === 'creating' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="plus" size={17} color="#FFFFFF" />
                  <Text style={styles.ctaLabel}>단어장 만들기</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* Mute toggle (absolute, top-right) */}
        <Pressable style={styles.muteToggle} onPress={toggleMute} hitSlop={8}>
          <Feather
            name={muted ? 'volume-x' : 'volume-2'}
            size={15}
            color="#FFFFFFE0"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default React.memo(SpotlightHero);

const styles = StyleSheet.create({
  hero: {
    height: 300,
    marginHorizontal: Dimens.screenPadding,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#16161E',
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: 16,
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#16161E',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000059',
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  songArtist: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFFCC',
  },
  lyricQuote: {
    gap: 7,
  },
  jpLine: {
    fontSize: 23,
    fontWeight: '600',
  },
  krLine: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFFD6',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cta: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF2E',
    borderWidth: 1,
    borderColor: '#FFFFFF5C',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  muteToggle: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF24',
    borderWidth: 1,
    borderColor: '#FFFFFF42',
  },
});
