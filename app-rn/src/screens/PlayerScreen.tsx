import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSearchStore } from '../stores/searchStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import { Token, StudyUnit } from '../types/song';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

const PARTICLE_POS = ['助詞', '助動詞', '記号'];

const MV_EXPANDED = 220;
const MV_COLLAPSED = 56;

function getUnderlineColor(pos: string): string | null {
  if (PARTICLE_POS.includes(pos)) return null;
  if (pos === '動詞') return Colors.posVerb;
  if (pos === '形容詞') return Colors.posAdjective;
  if (pos === '副詞') return Colors.posAdverb;
  return Colors.posNoun;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen({ navigation }: Props) {
  const { studyData, resetAnalyze } = useSearchStore();
  const vocabStore = useVocabularyStore();

  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekFraction, setSeekFraction] = useState(0);
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordSheetRef = useRef<BottomSheet>(null);
  const progressWidth = useRef(0);

  // Animated MV height for smooth drag transition
  const mvHeight = useRef(new Animated.Value(MV_EXPANDED)).current;
  const mvCollapsedRef = useRef(false);
  const dragStartH = useRef(MV_EXPANDED);

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        dragStartH.current = mvCollapsedRef.current ? MV_COLLAPSED : MV_EXPANDED;
      },
      onPanResponderMove: (_, gs) => {
        mvHeight.setValue(
          Math.max(MV_COLLAPSED, Math.min(MV_EXPANDED, dragStartH.current + gs.dy))
        );
      },
      onPanResponderRelease: (_, gs) => {
        let target: number;
        if (Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          target = mvCollapsedRef.current ? MV_EXPANDED : MV_COLLAPSED;
        } else {
          const h = Math.max(MV_COLLAPSED, Math.min(MV_EXPANDED, dragStartH.current + gs.dy));
          target = gs.vy < -0.3 || h < (MV_EXPANDED + MV_COLLAPSED) / 2 ? MV_COLLAPSED : MV_EXPANDED;
        }
        mvCollapsedRef.current = target === MV_COLLAPSED;
        Animated.spring(mvHeight, {
          toValue: target,
          useNativeDriver: false,
          bounciness: 4,
          speed: 14,
        }).start();
      },
    })
  ).current;

  const { width: screenWidth } = useWindowDimensions();

  // Video position/size interpolations (full-width → 64x36 thumbnail)
  const videoLeft = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_EXPANDED],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });
  const videoTop = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_EXPANDED],
    outputRange: [10, 0], // (56 - 36) / 2 = 10
    extrapolate: 'clamp',
  });
  const videoWidth = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_EXPANDED],
    outputRange: [64, screenWidth],
    extrapolate: 'clamp',
  });
  const videoH = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_EXPANDED],
    outputRange: [36, MV_EXPANDED],
    extrapolate: 'clamp',
  });
  const videoRadius = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_EXPANDED],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });
  const infoOpacity = mvHeight.interpolate({
    inputRange: [MV_COLLAPSED, MV_COLLAPSED + 50, MV_EXPANDED],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  if (!studyData) return null;

  const { song, studyUnits, youtubeUrl } = studyData;
  const isSynced = song.lyricType === 'SYNCED';
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  const handleTimeChange = useCallback((seconds: number) => {
    setCurrentMs(seconds * 1000);
  }, []);

  const handleDurationChange = useCallback((seconds: number) => {
    if (seconds > 0) setDurationMs(seconds * 1000);
  }, []);

  const handleBack = () => {
    resetAnalyze();
    navigation.goBack();
  };

  const handleTokenPress = (token: Token, lineText: string) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    vocabStore.resetLookup();
    vocabStore.lookupWord(token.baseForm);
    vocabStore.getWord(token.baseForm);
    wordSheetRef.current?.expand();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  const handleAddWord = () => {
    if (vocabStore.definition) {
      vocabStore.addWord(vocabStore.definition, song.id, selectedLine);
    }
  };

  const currentLineIndex = isSynced
    ? studyUnits.reduce((acc, unit, idx) => {
        if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
        return acc;
      }, 0)
    : -1;

  const progress = durationMs > 0 ? currentMs / durationMs : 0;
  const displayProgress = isSeeking ? seekFraction : progress;

  // Seeking handlers
  const handleProgressLayout = useCallback((e: LayoutChangeEvent) => {
    progressWidth.current = e.nativeEvent.layout.width;
  }, []);

  const handleSeekGrant = useCallback((e: GestureResponderEvent) => {
    const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressWidth.current));
    setSeekFraction(fraction);
    setIsSeeking(true);
  }, []);

  const handleSeekMove = useCallback((e: GestureResponderEvent) => {
    const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / progressWidth.current));
    setSeekFraction(fraction);
  }, []);

  const handleSeekRelease = useCallback(() => {
    setIsSeeking(false);
    const seekSec = (seekFraction * durationMs) / 1000;
    setCurrentMs(seekFraction * durationMs);
    youtubeRef.current?.seekTo(seekSec);
  }, [seekFraction, durationMs]);

  const renderToken = (token: Token, ti: number, isActive: boolean, lineText: string) => {
    const underlineColor = getUnderlineColor(token.partOfSpeech);
    const isParticle = underlineColor === null;
    const textStyle = isActive ? styles.tokenTextActive : styles.tokenTextInactive;

    if (isParticle) {
      return (
        <Text key={ti} style={textStyle}>{token.surface}</Text>
      );
    }

    return (
      <TouchableOpacity
        key={ti}
        onPress={() => handleTokenPress(token, lineText)}
        activeOpacity={0.6}
      >
        <View style={styles.tokenWithUnderline}>
          <Text style={textStyle}>{token.surface}</Text>
          <View style={[styles.underline, { backgroundColor: underlineColor, opacity: isActive ? 1 : 0.35 }]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderLyricLine = ({ item, index }: { item: StudyUnit; index: number }) => {
    const isActive = isSynced && index === currentLineIndex;
    return (
      <View style={styles.lineContainer}>
        <View style={styles.tokensRow}>
          {item.tokens.length > 0
            ? (() => {
                const elements: React.ReactNode[] = [];
                let cursor = 0;
                item.tokens.forEach((token, ti) => {
                  if (token.charStart > cursor) {
                    const gap = item.originalText.slice(cursor, token.charStart);
                    elements.push(
                      <Text key={`gap-${ti}`} style={isActive ? styles.tokenTextActive : styles.tokenTextInactive}>{gap}</Text>
                    );
                  }
                  elements.push(renderToken(token, ti, isActive, item.originalText));
                  cursor = token.charEnd;
                });
                if (cursor < item.originalText.length) {
                  elements.push(
                    <Text key="tail" style={isActive ? styles.tokenTextActive : styles.tokenTextInactive}>
                      {item.originalText.slice(cursor)}
                    </Text>
                  );
                }
                return elements;
              })()
            : (
              <Text style={isActive ? styles.tokenTextActive : styles.tokenTextInactive}>
                {item.originalText}
              </Text>
            )}
        </View>
        {item.koreanPronounciation && (
          <Text style={isActive ? styles.pronActive : styles.pronInactive}>
            {item.koreanPronounciation}
          </Text>
        )}
        {item.koreanLyrics && (
          <Text style={isActive ? styles.translationActive : styles.translationInactive}>
            {item.koreanLyrics}
          </Text>
        )}
      </View>
    );
  };

  const seekThumbLeft = displayProgress * progressWidth.current - 8;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* MV Area — video shrinks with aspect ratio, info fades in */}
      <Animated.View style={[styles.mvArea, { height: mvHeight }]}>
        {/* Video — animates from full-width to 64x36 thumbnail */}
        <Animated.View style={{
          position: 'absolute',
          left: videoLeft,
          top: videoTop,
          width: videoWidth,
          height: videoH,
          borderRadius: videoRadius,
          overflow: 'hidden',
        }}>
          {videoId ? (
            <YouTubePlayer
              ref={youtubeRef}
              videoId={videoId}
              onTimeChange={handleTimeChange}
              onDurationChange={handleDurationChange}
            />
          ) : (
            <View style={styles.mvPlaceholder}>
              <View style={styles.mvPlayBtn}>
                <Feather name="play" size={24} color="#FFFFFF" />
              </View>
            </View>
          )}
        </Animated.View>
        {/* Song info + play button — fade in when collapsed */}
        <Animated.View style={[styles.mvInfoOverlay, { opacity: infoOpacity }]} pointerEvents="box-none">
          <View style={styles.mvInfoTexts}>
            <Text style={styles.mvInfoTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.mvInfoArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
          <View style={styles.mvInfoPlayBtn}>
            <Feather name="play" size={16} color="#FFFFFF" />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Lyrics area (static view, scrollable FlatList inside) */}
      <View style={styles.bottomSheetOuter}>
        <View style={styles.bottomSheetInner}>
          {/* Drag handle — drag or tap to collapse/expand MV */}
          <View style={styles.dragHandle} {...handlePan.panHandlers}>
            <View style={styles.dragBar} />
          </View>

          {/* Scrollable lyrics */}
          <View style={styles.scrollContent}>
            <FlatList
              data={studyUnits}
              keyExtractor={(item) => String(item.index)}
              renderItem={renderLyricLine}
              ListHeaderComponent={
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                </View>
              }
              contentContainerStyle={styles.lyricsList}
            />
            {/* Fade gradient at bottom of lyrics */}
            <View style={styles.fadeGradient} pointerEvents="none">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: `rgba(255,255,255,${(i / 7) * (i / 7)})`,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Mini player */}
      <View style={styles.miniPlayer}>
        <View
          style={styles.progressTouchArea}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleSeekGrant}
          onResponderMove={handleSeekMove}
          onResponderRelease={handleSeekRelease}
          onResponderTerminate={handleSeekRelease}
          onLayout={handleProgressLayout}
        >
          {/* Seek tooltip (above progress bar) */}
          {isSeeking && progressWidth.current > 0 && (
            <View style={[styles.seekTooltipWrap, { left: Math.max(0, Math.min(seekThumbLeft - 12, progressWidth.current - 50)) }]}>
              <View style={styles.seekTooltip}>
                <Text style={styles.seekTooltipText}>{formatTime(seekFraction * durationMs)}</Text>
              </View>
              <View style={styles.seekArrow} />
            </View>
          )}
          <View style={[styles.progressTrack, isSeeking && styles.progressTrackSeeking]}>
            <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }, isSeeking && styles.progressFillSeeking]} />
          </View>
          {/* Seek thumb */}
          {isSeeking && progressWidth.current > 0 && (
            <View style={[styles.seekThumb, { left: seekThumbLeft }]} />
          )}
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(isSeeking ? seekFraction * durationMs : currentMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Word lookup bottom sheet (design screens 2/2a/2b) */}
      <BottomSheet
        ref={wordSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={12}
        backdropComponent={renderBackdrop}
        style={styles.wordSheetFloat}
        backgroundStyle={styles.wordSheetBg}
        handleIndicatorStyle={styles.wordSheetIndicator}
        handleStyle={styles.wordSheetHandle}
      >
        <BottomSheetView>
          {selectedToken && (
            <WordAnalysisSheet
              token={selectedToken}
              lookupStatus={vocabStore.lookupStatus}
              definition={vocabStore.definition}
              lookupError={vocabStore.lookupError}
              addStatus={vocabStore.addStatus}
              getWordStatus={vocabStore.getWordStatus}
              existingWord={vocabStore.existingWord}
              songId={song.id}
              lyricLine={selectedLine}
              onAddWord={handleAddWord}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // MV Area - Expanded
  mvArea: {
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  mvPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mvPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF40',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MV collapsed info (song title, artist, play button)
  mvInfoOverlay: {
    position: 'absolute',
    left: 86, // 12 + 64 + 10
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mvInfoTexts: {
    flex: 1,
    gap: 2,
  },
  mvInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mvInfoArtist: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFFBB',
  },
  mvInfoPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom Sheet Container (lyrics area)
  bottomSheetOuter: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomSheetInner: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },

  // Drag Handle
  dragHandle: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },

  // Scroll Content
  scrollContent: {
    flex: 1,
  },

  // Song Info (inside bottom sheet, above lyrics)
  songInfo: {
    paddingTop: 32,
    paddingBottom: 24,
    gap: 6,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  songArtist: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // Lyrics
  lyricsList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Line
  lineContainer: {
    marginBottom: 20,
    gap: 4,
  },

  // Tokens
  tokensRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 3,
  },
  tokenTextActive: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tokenTextInactive: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tokenWithUnderline: {
    position: 'relative',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  // Pronunciation
  pronActive: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pronInactive: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Translation
  translationActive: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  translationInactive: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Mini player
  miniPlayer: {},
  progressTouchArea: {
    paddingTop: 30,
    marginTop: -30,
    justifyContent: 'flex-end',
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.border,
  },
  progressTrackSeeking: {
    height: 4,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.primary,
  },
  progressFillSeeking: {
    height: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // Seek UI (screen 1b)
  seekThumb: {
    position: 'absolute',
    bottom: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  seekTooltipWrap: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
  },
  seekTooltip: {
    backgroundColor: '#1A1A1AEE',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  seekTooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  seekArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A1AEE',
  },

  // Word lookup bottom sheet (design screens 2/2a/2b)
  wordSheetFloat: {
    marginHorizontal: 12,
  },
  wordSheetBg: {
    backgroundColor: Colors.card,
    borderRadius: 24,
  },
  wordSheetHandle: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  wordSheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
});
