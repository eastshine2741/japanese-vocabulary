import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSongDetailStore } from '../stores/songDetailStore';
import { usePlayerStore } from '../stores/playerStore';
import { deckApi } from '../api/deckApi';
import { wordApi } from '../api/wordApi';
import SongInfoSheet from '../components/SongInfoSheet';
import {
  CurrentPlayingWordsSheet,
  CURRENT_PLAYING_WORDS_PEEK_HEIGHT,
  SongDetailHomeTab,
  SONG_DETAIL_MV_BAR_HEIGHT,
  SongDetailMvBar,
  SongDetailWordsTab,
} from '../components/songDetail';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SongDetail'>;
type DetailTab = 'home' | 'words';

const HERO_HEIGHT = 360;
const COLLAPSED_BAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 44;
const HERO_SCROLL_COLLAPSE_START = HERO_HEIGHT - COLLAPSED_BAR_HEIGHT - TAB_BAR_HEIGHT - 34;
const HERO_SCROLL_COLLAPSE_END = HERO_SCROLL_COLLAPSE_START + 56;

export default function SongDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const infoSheetRef = useRef<BottomSheet>(null);
  const infoSheetOpenRef = useRef(false);

  const status = useSongDetailStore(s => s.status);
  const data = useSongDetailStore(s => s.data);
  const errorCode = useSongDetailStore(s => s.errorCode);
  const load = useSongDetailStore(s => s.load);
  const preloadedStudyData = usePlayerStore(s => s.studyData);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);

  const [activeTab, setActiveTab] = useState<DetailTab>('home');
  const [vocabDeckId, setVocabDeckId] = useState<number | null>(null);
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [isPinnedTabsVisible, setIsPinnedTabsVisible] = useState(false);
  const isPinnedTabsVisibleRef = useRef(false);

  const routeSongId = route.params?.songId;
  const fallbackSongId = preloadedStudyData?.song.id;
  const songId = routeSongId ?? fallbackSongId;

  useEffect(() => {
    if (songId == null) return;
    setCurrentMs(route.params?.initialSeekMs ?? 0);
    setDurationMs(0);
    load(songId);
  }, [load, route.params?.initialSeekMs, setCurrentMs, setDurationMs, songId]);

  useEffect(() => {
    if (songId == null) {
      setVocabDeckId(null);
      return;
    }
    let cancelled = false;
    deckApi.getDeckBySongId(songId)
      .then(deck => {
        if (!cancelled) setVocabDeckId(deck?.deckId ?? null);
      })
      .catch(() => {
        if (!cancelled) setVocabDeckId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const collapsedOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_START, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const pinnedTabsOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [HERO_SCROLL_COLLAPSE_END - 1, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const heroTextTranslate = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, HERO_SCROLL_COLLAPSE_END],
      outputRange: [0, -24],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const bottomReserve = SONG_DETAIL_MV_BAR_HEIGHT + CURRENT_PLAYING_WORDS_PEEK_HEIGHT + insets.bottom;

  const defaultDeckWords = useMemo(() => {
    const detail = data?.words;
    if (!detail) return [];
    const pos = new Set(detail.filterDefaults.pos);
    const jlpt = new Set(detail.filterDefaults.jlpt);
    const includeUnknown = detail.filterDefaults.includeUnknownJlpt;
    return detail.words
      .filter(word => {
        const matchesPos = pos.has(word.partOfSpeech);
        const matchesJlpt = word.jlpt == null ? includeUnknown : jlpt.has(word.jlpt);
        return matchesPos && matchesJlpt && !word.isSavedForSong;
      })
      .map(word => word.addRequest);
  }, [data]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenInfo = useCallback(() => {
    infoSheetOpenRef.current = true;
    infoSheetRef.current?.expand();
  }, []);

  const handleInfoSheetChange = useCallback((index: number) => {
    infoSheetOpenRef.current = index >= 0;
  }, []);

  const handleOpenDeck = useCallback(async () => {
    if (vocabDeckId != null) {
      navigation.navigate('DeckDetail', { deckId: vocabDeckId });
      return;
    }
    if (songId == null || defaultDeckWords.length === 0 || isCreatingDeck) return;
    setIsCreatingDeck(true);
    try {
      await wordApi.batchAddWords({ words: defaultDeckWords });
      const deck = await deckApi.getDeckBySongId(songId);
      const nextDeckId = deck?.deckId ?? null;
      setVocabDeckId(nextDeckId);
      if (nextDeckId != null) {
        navigation.navigate('DeckDetail', { deckId: nextDeckId });
      }
      load(songId);
    } finally {
      setIsCreatingDeck(false);
    }
  }, [defaultDeckWords, isCreatingDeck, load, navigation, songId, vocabDeckId]);

  const handleSelectHome = useCallback(() => {
    setActiveTab('home');
  }, []);

  const handleSelectWords = useCallback(() => {
    setActiveTab('words');
  }, []);

  const handleWordsChanged = useCallback(() => {
    if (songId == null) return;
    load(songId);
    deckApi.getDeckBySongId(songId)
      .then(deck => setVocabDeckId(deck?.deckId ?? null))
      .catch(() => setVocabDeckId(null));
  }, [load, songId]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (infoSheetOpenRef.current) {
          infoSheetOpenRef.current = false;
          infoSheetRef.current?.close();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: false,
        listener: event => {
          const y = (event as NativeSyntheticEvent<NativeScrollEvent>).nativeEvent.contentOffset.y;
          const nextVisible = y >= HERO_SCROLL_COLLAPSE_END;
          if (isPinnedTabsVisibleRef.current !== nextVisible) {
            isPinnedTabsVisibleRef.current = nextVisible;
            setIsPinnedTabsVisible(nextVisible);
          }
        },
      },
    ),
    [scrollY],
  );

  if (songId == null) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>곡 정보를 찾을 수 없어요.</Text>
      </View>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (status === 'error' || data == null) {
    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{errorCode ?? '곡 정보를 불러오지 못했어요.'}</Text>
      </View>
    );
  }

  const { song, lyrics, words } = data;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomReserve }]}
      >
        <View style={styles.hero}>
          {song.artworkUrl ? (
            <ImageBackground source={{ uri: song.artworkUrl }} style={styles.heroArtwork} resizeMode="cover" />
          ) : (
            <View style={[styles.heroArtwork, styles.heroFallback]} />
          )}
          <View style={styles.heroScrim} />
          <View style={[styles.heroTop, { paddingTop: insets.top + 6 }]}>
            <IconButton icon="chevron-left" onPress={handleBack} />
            <IconButton icon="info" onPress={handleOpenInfo} />
          </View>
          <Animated.View style={[styles.heroInfo, { transform: [{ translateY: heroTextTranslate }] }]}>
            <Text style={styles.heroTitle} numberOfLines={2}>{song.title}</Text>
            <Text style={styles.heroArtist} numberOfLines={1}>{song.artist}</Text>
            <Pressable
              style={[styles.deckButton, isCreatingDeck && styles.disabledButton]}
              onPress={handleOpenDeck}
              disabled={isCreatingDeck}
            >
              <Feather name="plus" size={17} color="#FFFFFF" />
              <Text style={styles.deckButtonText}>단어장 만들기</Text>
            </Pressable>
          </Animated.View>
        </View>

        <SongDetailTabs
          activeTab={activeTab}
          onSelectHome={handleSelectHome}
          onSelectWords={handleSelectWords}
        />

        {activeTab === 'home' ? (
          <SongDetailHomeTab
            words={words.words}
            onViewAllWordsPress={handleSelectWords}
          />
        ) : (
          <SongDetailWordsTab
            data={{
              words: words.words,
              wordSummary: words.wordSummary,
              filterDefaults: words.filterDefaults,
              lineWordIndexes: words.lineWordIndexes,
            }}
            bottomPadding={0}
            onWordsChanged={handleWordsChanged}
          />
        )}
      </Animated.ScrollView>

      <PlaybackOverlays
        title={song.title}
        artist={song.artist}
        youtubeUrl={song.youtubeUrl}
        initialSeekMs={route.params?.initialSeekMs}
        initialLyricIndex={route.params?.initialLyricIndex}
        bottomInset={insets.bottom}
        lines={lyrics.lines}
        words={words.words}
        lineWordIndexes={words.lineWordIndexes}
      />

      <Animated.View
        pointerEvents={isPinnedTabsVisible ? 'box-none' : 'none'}
        style={[
          styles.collapsedBar,
          { height: insets.top + COLLAPSED_BAR_HEIGHT, paddingTop: insets.top, opacity: collapsedOpacity },
        ]}
      >
        {song.artworkUrl ? (
          <ImageBackground source={{ uri: song.artworkUrl }} style={styles.collapsedArtworkBg} resizeMode="cover" />
        ) : (
          <View style={[styles.collapsedArtworkBg, styles.heroFallback]} />
        )}
        <View style={styles.collapsedScrim} />
        <IconButton icon="chevron-left" onPress={handleBack} />
        {song.artworkUrl ? (
          <ImageBackground source={{ uri: song.artworkUrl }} style={styles.collapsedArtworkThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.collapsedArtworkThumb, styles.heroFallback]} />
        )}
        <View style={styles.collapsedTitleBlock}>
          <Text style={styles.collapsedTitle} numberOfLines={1}>{song.title}</Text>
          <Text style={styles.collapsedArtist} numberOfLines={1}>{song.artist}</Text>
        </View>
        <IconButton icon="info" onPress={handleOpenInfo} />
        <Pressable
          style={[styles.collapsedDeckButton, isCreatingDeck && styles.disabledButton]}
          onPress={handleOpenDeck}
          disabled={isCreatingDeck}
        >
          <Feather name="plus" size={13} color="#FFFFFF" />
          <Text style={styles.collapsedDeckButtonText} numberOfLines={1}>단어장 만들기</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={isPinnedTabsVisible ? 'auto' : 'none'}
        style={[
          styles.pinnedTabBar,
          {
            top: insets.top + COLLAPSED_BAR_HEIGHT,
            opacity: pinnedTabsOpacity,
          },
        ]}
      >
        <SongDetailTabs
          activeTab={activeTab}
          onSelectHome={handleSelectHome}
          onSelectWords={handleSelectWords}
        />
      </Animated.View>

      <BottomSheet
        ref={infoSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        onChange={handleInfoSheetChange}
        bottomInset={insets.bottom + 12}
        backdropComponent={renderBackdrop}
        style={styles.infoSheetFloat}
        backgroundStyle={styles.infoSheetBg}
        handleStyle={styles.infoSheetHandle}
        handleIndicatorStyle={styles.infoSheetIndicator}
      >
        <BottomSheetView>
          <SongInfoSheet
            songId={song.id}
            title={song.title}
            artist={song.artist}
            lyricsSourceName={lyrics.lyricsSourceName}
            lyricsSourceUrl={lyrics.lyricsSourceUrl}
          />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

interface PlaybackOverlaysProps {
  title: string;
  artist: string;
  youtubeUrl: string | null;
  initialSeekMs?: number;
  initialLyricIndex?: number;
  bottomInset: number;
  lines: React.ComponentProps<typeof CurrentPlayingWordsSheet>['lines'];
  words: React.ComponentProps<typeof CurrentPlayingWordsSheet>['words'];
  lineWordIndexes: Record<string, number[]>;
}

const PlaybackOverlays = React.memo(function PlaybackOverlays({
  title,
  artist,
  youtubeUrl,
  initialSeekMs,
  initialLyricIndex,
  bottomInset,
  lines,
  words,
  lineWordIndexes,
}: PlaybackOverlaysProps) {
  const currentMs = usePlayerStore(s => s.currentMs);
  const durationMs = usePlayerStore(s => s.durationMs);
  const setCurrentMs = usePlayerStore(s => s.setCurrentMs);
  const setDurationMs = usePlayerStore(s => s.setDurationMs);

  return (
    <>
      <CurrentPlayingWordsSheet
        lines={lines}
        words={words}
        lineWordIndexes={lineWordIndexes}
        currentTimeMs={currentMs}
        fallbackLineIndex={initialLyricIndex}
        bottomInset={bottomInset + SONG_DETAIL_MV_BAR_HEIGHT}
      />
      <SongDetailMvBar
        title={title}
        artist={artist}
        youtubeUrl={youtubeUrl}
        initialSeekMs={initialSeekMs}
        currentTimeMs={currentMs}
        durationMs={durationMs}
        bottomInset={bottomInset}
        onCurrentTimeChange={setCurrentMs}
        onDurationChange={setDurationMs}
      />
    </>
  );
});

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  dark?: boolean;
}

const IconButton = React.memo(function IconButton({ icon, onPress, dark = false }: IconButtonProps) {
  return (
    <Pressable
      style={[styles.iconButton, dark ? styles.iconButtonLight : styles.iconButtonDark]}
      onPress={onPress}
      hitSlop={8}
    >
      <Feather name={icon} size={22} color={dark ? Colors.textPrimary : '#FFFFFF'} />
    </Pressable>
  );
});

interface TabsProps {
  activeTab: DetailTab;
  onSelectHome: () => void;
  onSelectWords: () => void;
}

const SongDetailTabs = React.memo(function SongDetailTabs({
  activeTab,
  onSelectHome,
  onSelectWords,
}: TabsProps) {
  return (
    <View style={styles.tabBar}>
      <TabButton label="홈" isActive={activeTab === 'home'} onPress={onSelectHome} />
      <TabButton label="단어" isActive={activeTab === 'words'} onPress={onSelectWords} />
    </View>
  );
});

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

const TabButton = React.memo(function TabButton({ label, isActive, onPress }: TabButtonProps) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
      <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    backgroundColor: Colors.background,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Dimens.screenPadding,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  hero: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.textPrimary,
  },
  heroArtwork: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFallback: {
    backgroundColor: Colors.textPrimary,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000080',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
    elevation: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    backgroundColor: '#0000002E',
  },
  iconButtonLight: {
    backgroundColor: Colors.surface,
  },
  heroInfo: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 26,
    gap: 8,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroArtist: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFFCC',
    marginBottom: 10,
  },
  deckButton: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF80',
    backgroundColor: '#FFFFFF26',
  },
  deckButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    minWidth: 28,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
  },
  tabIndicator: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: Colors.primary,
  },
  collapsedBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.textPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFFFFF24',
    overflow: 'hidden',
  },
  pinnedTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 12,
    elevation: 12,
  },
  collapsedArtworkBg: {
    ...StyleSheet.absoluteFillObject,
  },
  collapsedScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000075',
  },
  collapsedArtworkThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#00000040',
  },
  collapsedTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  collapsedArtist: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFFCC',
  },
  collapsedDeckButton: {
    height: 36,
    maxWidth: 136,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF80',
    backgroundColor: '#FFFFFF26',
  },
  collapsedDeckButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.55,
  },
  infoSheetFloat: {
    marginHorizontal: 12,
    zIndex: 100,
    elevation: 100,
  },
  infoSheetBg: {
    backgroundColor: Colors.card,
    borderRadius: 24,
  },
  infoSheetHandle: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  infoSheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
});
