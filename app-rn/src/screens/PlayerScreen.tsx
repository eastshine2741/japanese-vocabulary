import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
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
  const [mvCollapsed, setMvCollapsed] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekFraction, setSeekFraction] = useState(0);
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordSheetRef = useRef<BottomSheet>(null);
  const progressWidth = useRef(0);

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
      {/* MV Area */}
      {mvCollapsed ? (
        <TouchableOpacity
          style={styles.mvCollapsedBar}
          onPress={() => setMvCollapsed(false)}
          activeOpacity={0.8}
        >
          <View style={styles.mvThumb} />
          <View style={styles.mvCollapsedTexts}>
            <Text style={styles.mvCollapsedTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.mvCollapsedArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
          <View style={styles.mvCollapsedPlayBtn}>
            <Feather name="play" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.mvArea}>
          {videoId ? (
            <YouTubePlayer
              ref={youtubeRef}
              videoId={videoId}
              height={220}
              onTimeChange={handleTimeChange}
              onDurationChange={handleDurationChange}
            />
          ) : (
            <TouchableOpacity
              style={styles.mvPlaceholder}
              onPress={() => setMvCollapsed(true)}
              activeOpacity={0.9}
            >
              <View style={styles.mvPlayBtn}>
                <Feather name="play" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lyrics area (static view, scrollable FlatList inside) */}
      <View style={styles.bottomSheetOuter}>
        <View style={styles.bottomSheetInner}>
          {/* Drag handle — tap to toggle MV collapse/expand */}
          <TouchableOpacity
            style={styles.dragHandle}
            onPress={() => setMvCollapsed(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.dragBar} />
          </TouchableOpacity>

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
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.wordSheetBg}
        handleIndicatorStyle={styles.wordSheetIndicator}
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
    height: 220,
    backgroundColor: '#1A1A1A',
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

  // MV Area - Collapsed (screen 1a)
  mvCollapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  mvThumb: {
    width: 64,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#333333',
  },
  mvCollapsedTexts: {
    flex: 1,
    gap: 2,
  },
  mvCollapsedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mvCollapsedArtist: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFFBB',
  },
  mvCollapsedPlayBtn: {
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
  wordSheetBg: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  wordSheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
});
