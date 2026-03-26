import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  clamp,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePlayerStore } from '../stores/playerStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { songApi } from '../api/songApi';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import LyricLine from '../components/LyricLine';
import SeekBar from '../components/SeekBar';
import { Token, StudyUnit } from '../types/song';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

const MV_EXPANDED = 220;
const MV_COLLAPSED = 56;
const DISMISS_THRESHOLD = 250;

export default function PlayerScreen({ navigation }: Props) {
  const { studyData, reset: resetPlayer } = usePlayerStore();
  const vocabStore = useVocabularyStore();

  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedKoreanLine, setSelectedKoreanLine] = useState<string | null>(null);
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordSheetRef = useRef<BottomSheet>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    resetPlayer();
    navigation.goBack();
  }, [resetPlayer, navigation]);

  // Reanimated: MV height shared value (runs on UI thread)
  const mvHeight = useSharedValue(MV_EXPANDED);
  const dragStartH = useSharedValue(MV_EXPANDED);
  const dismissY = useSharedValue(0);

  const snapConfig = { duration: 250, easing: Easing.out(Easing.cubic) };

  const makePanGesture = () => Gesture.Pan()
    .onStart(() => {
      dragStartH.value = mvHeight.value;
    })
    .onUpdate((e) => {
      const rawH = dragStartH.value + e.translationY;
      if (rawH > MV_EXPANDED) {
        mvHeight.value = MV_EXPANDED;
        dismissY.value = rawH - MV_EXPANDED;
      } else {
        mvHeight.value = clamp(rawH, MV_COLLAPSED, MV_EXPANDED);
        dismissY.value = 0;
      }
    })
    .onEnd((e) => {
      if (dismissY.value > 0) {
        if (dismissY.value > DISMISS_THRESHOLD || e.velocityY > 500) {
          dismissY.value = withTiming(screenHeight, { duration: 300, easing: Easing.in(Easing.cubic) });
          runOnJS(handleBack)();
        } else {
          dismissY.value = withTiming(0, snapConfig);
        }
      } else {
        if (Math.abs(e.translationY) < 10 && Math.abs(e.translationX) < 10) {
          const target = mvHeight.value < (MV_EXPANDED + MV_COLLAPSED) / 2 ? MV_EXPANDED : MV_COLLAPSED;
          mvHeight.value = withTiming(target, snapConfig);
        } else {
          const target = e.velocityY < -300 || mvHeight.value < (MV_EXPANDED + MV_COLLAPSED) / 2
            ? MV_COLLAPSED : MV_EXPANDED;
          mvHeight.value = withTiming(target, snapConfig);
        }
      }
    });

  const handleGesture = useMemo(() => makePanGesture(), []);
  const mvGesture = useMemo(() => makePanGesture(), []);

  const mvAreaStyle = useAnimatedStyle(() => ({
    height: mvHeight.value,
  }));

  const videoStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: interpolate(mvHeight.value, [MV_COLLAPSED, MV_EXPANDED], [12, 0], 'clamp'),
    top: interpolate(mvHeight.value, [MV_COLLAPSED, MV_EXPANDED], [10, 0], 'clamp'),
    width: interpolate(mvHeight.value, [MV_COLLAPSED, MV_EXPANDED], [64, screenWidth], 'clamp'),
    height: interpolate(mvHeight.value, [MV_COLLAPSED, MV_EXPANDED], [36, MV_EXPANDED], 'clamp'),
    borderRadius: interpolate(mvHeight.value, [MV_COLLAPSED, MV_EXPANDED], [6, 0], 'clamp'),
    overflow: 'hidden' as const,
  }));

  const infoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mvHeight.value, [MV_COLLAPSED, MV_COLLAPSED + 50, MV_EXPANDED], [1, 0, 0], 'clamp'),
  }));

  const dismissStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, screenHeight * 0.5], [1, 0], 'clamp'),
  }));

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

  const handleStateChange = useCallback((state: string) => {
    setIsPlaying(state === 'playing');
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      youtubeRef.current?.pause();
    } else {
      youtubeRef.current?.play();
    }
  }, [isPlaying]);

  const handleTokenPress = (token: Token, lineText: string, koreanLyrics: string | null) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    setSelectedKoreanLine(koreanLyrics);
    vocabStore.resetLookup();
    vocabStore.getWord(token.baseForm);
    wordSheetRef.current?.expand();
  };

  const handleSeek = useCallback((ms: number) => {
    setCurrentMs(ms);
    youtubeRef.current?.seekTo(ms / 1000);
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  const handleAddWord = () => {
    if (selectedToken) {
      vocabStore.addWord(selectedToken, song.id, selectedLine, selectedKoreanLine);
    }
  };

  const isTranslationPending = studyUnits.length > 0
    && studyUnits.some(u => u.originalText.trim() !== '')
    && studyUnits.every(u => u.koreanLyrics === null);

  const currentLineIndex = isSynced
    ? studyUnits.reduce((acc, unit, idx) => {
        if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
        return acc;
      }, 0)
    : -1;

  const handleRefreshLyrics = async () => {
    try {
      const data = await songApi.getById(song.id);
      usePlayerStore.setState({ studyData: data });
    } catch {}
  };

  const renderLyricLine = ({ item, index }: { item: StudyUnit; index: number }) => (
    <LyricLine
      studyUnit={item}
      isActive={isSynced && index === currentLineIndex}
      onTokenPress={handleTokenPress}
    />
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Animated.View style={[styles.dismissWrapper, dismissStyle]}>
      {/* MV Area — video shrinks with aspect ratio, info fades in */}
      <GestureDetector gesture={mvGesture}>
      <Animated.View style={[styles.mvArea, mvAreaStyle]}>
        <Animated.View style={videoStyle} pointerEvents="none">
          {videoId ? (
            <YouTubePlayer
              ref={youtubeRef}
              videoId={videoId}
              onTimeChange={handleTimeChange}
              onDurationChange={handleDurationChange}
              onStateChange={handleStateChange}
            />
          ) : (
            <View style={styles.mvPlaceholder}>
              <View style={styles.mvPlayBtn}>
                <Feather name="play" size={24} color="#FFFFFF" />
              </View>
            </View>
          )}
        </Animated.View>
        <Animated.View style={[styles.mvInfoOverlay, infoStyle]} pointerEvents="box-none">
          <View style={styles.mvInfoTexts}>
            <Text style={styles.mvInfoTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.mvInfoArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
          <TouchableOpacity style={styles.mvInfoPlayBtn} onPress={togglePlayPause} activeOpacity={0.6}>
            <Feather name={isPlaying ? 'pause' : 'play'} size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
      </GestureDetector>

      {/* Lyrics area */}
      <View style={styles.bottomSheetOuter}>
        <View style={styles.bottomSheetInner}>
          <GestureDetector gesture={handleGesture}>
            <Animated.View style={styles.dragHandle}>
              <View style={styles.dragBar} />
            </Animated.View>
          </GestureDetector>

          <View style={styles.scrollContent}>
            <FlatList
              data={studyUnits}
              keyExtractor={(item) => String(item.index)}
              renderItem={renderLyricLine}
              ListHeaderComponent={
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                  {isTranslationPending && (
                    <View style={styles.notice}>
                      <View style={[styles.noticeIconWrap, { backgroundColor: Colors.elevated }]}>
                        <Feather name="globe" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.noticeTextWrap}>
                        <Text style={styles.noticeMain}>번역을 준비하고 있어요!</Text>
                        <Text style={styles.noticeSub}>금방 끝나요, 조금만 기다려 주세요</Text>
                      </View>
                      <TouchableOpacity style={styles.noticeRefreshBtn} onPress={handleRefreshLyrics} activeOpacity={0.6}>
                        <Feather name="refresh-cw" size={15} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {!isSynced && (
                    <View style={styles.notice}>
                      <View style={[styles.noticeIconWrap, { backgroundColor: Colors.elevated }]}>
                        <Feather name="music" size={18} color={Colors.textMuted} />
                      </View>
                      <View style={styles.noticeTextWrap}>
                        <Text style={styles.noticeMain}>이 노래는 싱크 가사가 없어요</Text>
                        <Text style={styles.noticeSub}>재생 위치에 맞춰 가사가 자동으로 따라가지 않아요</Text>
                      </View>
                    </View>
                  )}
                </View>
              }
              contentContainerStyle={styles.lyricsList}
            />
            <View style={styles.fadeGradientTop} pointerEvents="none">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: `rgba(255,255,255,${((7 - i) / 7) * ((7 - i) / 7)})`,
                  }}
                />
              ))}
            </View>
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
      <SeekBar currentMs={currentMs} durationMs={durationMs} onSeek={handleSeek} />
      </Animated.View>

      {/* Word lookup bottom sheet */}
      <BottomSheet
        ref={wordSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={safeBottom + 12}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  dismissWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // MV Area
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

  // MV collapsed info
  mvInfoOverlay: {
    position: 'absolute',
    left: 86,
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

  // Lyrics bottom sheet
  bottomSheetOuter: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {},
    }),
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
    height: 40,
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

  // Song Info
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

  // Notices
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTextWrap: {
    flex: 1,
    gap: 2,
  },
  noticeMain: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  noticeSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  noticeRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Lyrics
  lyricsList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  fadeGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Word lookup bottom sheet
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
