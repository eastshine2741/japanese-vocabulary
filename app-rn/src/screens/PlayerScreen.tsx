import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
  withDelay,
  cancelAnimation,
  interpolate,
  clamp,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/playerStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { songApi } from '../api/songApi';
import { wordApi } from '../api/wordApi';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import WordEditSheet from '../components/WordEditSheet';
import SongWordListSheet from '../components/SongWordListSheet';
import LyricLine from '../components/LyricLine';
import SeekBar from '../components/SeekBar';
import AppDialog from '../components/AppDialog';
import { Token, StudyUnit } from '../types/song';
import { AddWordRequest } from '../types/word';
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
const CONTROLS_FADE = 200;
const CONTROLS_HIDE_DELAY = 3000;

export default function PlayerScreen({ navigation, route }: Props) {
  const initialSeekMs = route.params?.initialSeekMs;
  const initialLyricIndex = route.params?.initialLyricIndex;
  const studyData = usePlayerStore(s => s.studyData);
  const resetPlayer = usePlayerStore(s => s.reset);
  const {
    addStatus, getWordStatus, existingWord,
    batchAddStatus, batchSavedCount, batchSkippedCount,
  } = useVocabularyStore(
    useShallow(s => ({
      addStatus: s.addStatus,
      getWordStatus: s.getWordStatus,
      existingWord: s.existingWord,
      batchAddStatus: s.batchAddStatus,
      batchSavedCount: s.batchSavedCount,
      batchSkippedCount: s.batchSkippedCount,
    })),
  );
  const resetLookup = useVocabularyStore(s => s.resetLookup);
  const getWord = useVocabularyStore(s => s.getWord);
  const vocabAddWord = useVocabularyStore(s => s.addWord);
  const resetBatchAdd = useVocabularyStore(s => s.resetBatchAdd);
  const batchAddWords = useVocabularyStore(s => s.batchAddWords);

  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedKoreanLine, setSelectedKoreanLine] = useState<string | null>(null);
  const [wordListVisible, setWordListVisible] = useState(false);
  const [wordEditVisible, setWordEditVisible] = useState(false);
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordSheetRef = useRef<BottomSheet>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();

  // Auto-scroll to current line
  const flatListRef = useRef<FlatList>(null);
  const visibleIndicesRef = useRef(new Set<number>());
  const scrollBtnVisible = useSharedValue(0);
  const prevScrollBtnShown = useRef(false);
  const currentLineIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const isSyncedRef = useRef(false);
  const initialSeekDone = useRef(false);
  const initialScrollDone = useRef(false);
  const followModeRef = useRef(true);
  const prevAutoScrollLineRef = useRef(-1);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    visibleIndicesRef.current = new Set(
      viewableItems.filter(v => v.index != null).map(v => v.index!),
    );
    const shouldShow = isSyncedRef.current && isPlayingRef.current
      && !followModeRef.current
      && currentLineIndexRef.current >= 0
      && !visibleIndicesRef.current.has(currentLineIndexRef.current);
    if (shouldShow !== prevScrollBtnShown.current) {
      prevScrollBtnShown.current = shouldShow;
      scrollBtnVisible.value = withTiming(shouldShow ? 1 : 0, { duration: 200 });
    }
  }).current;

  const scrollToCurrentLine = useCallback(() => {
    const idx = currentLineIndexRef.current;
    if (idx < 0) return;
    flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    followModeRef.current = false;
  }, []);

  const handleScrollBtnPress = useCallback(() => {
    followModeRef.current = true;
    prevAutoScrollLineRef.current = currentLineIndexRef.current;
    scrollToCurrentLine();
  }, [scrollToCurrentLine]);

  const scrollBtnAnimStyle = useAnimatedStyle(() => ({
    opacity: scrollBtnVisible.value,
  }));

  const handleBack = useCallback(() => {
    resetPlayer();
    navigation.goBack();
  }, [resetPlayer, navigation]);

  // Reanimated: MV height shared value (runs on UI thread)
  const mvHeight = useSharedValue(MV_EXPANDED);
  const dragStartH = useSharedValue(MV_EXPANDED);
  const dismissY = useSharedValue(0);

  // Controls visibility (tap-to-show / auto-hide)
  const controlsVisible = useSharedValue(0);
  const [controlsShown, setControlsShown] = useState(false);

  const showControls = useCallback(() => {
    'worklet';
    cancelAnimation(controlsVisible);
    controlsVisible.value = withTiming(1, { duration: CONTROLS_FADE }, (finished) => {
      if (finished) {
        controlsVisible.value = withDelay(
          CONTROLS_HIDE_DELAY,
          withTiming(0, { duration: CONTROLS_FADE }, (f2) => {
            if (f2) runOnJS(setControlsShown)(false);
          }),
        );
      }
    });
    runOnJS(setControlsShown)(true);
  }, []);

  const hideControls = useCallback(() => {
    'worklet';
    cancelAnimation(controlsVisible);
    controlsVisible.value = withTiming(0, { duration: CONTROLS_FADE }, (finished) => {
      if (finished) runOnJS(setControlsShown)(false);
    });
  }, []);

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

  const mvGesture = useMemo(() => {
    const tap = Gesture.Tap().onEnd(() => {
      const isExpanded = mvHeight.value > (MV_EXPANDED + MV_COLLAPSED) / 2;
      if (isExpanded) {
        if (controlsVisible.value > 0.5) {
          hideControls();
        } else {
          showControls();
        }
      } else {
        mvHeight.value = withTiming(MV_EXPANDED, snapConfig);
      }
    });

    const pan = Gesture.Pan()
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
          const target = e.velocityY < -300 || mvHeight.value < (MV_EXPANDED + MV_COLLAPSED) / 2
            ? MV_COLLAPSED : MV_EXPANDED;
          mvHeight.value = withTiming(target, snapConfig);
          if (target === MV_COLLAPSED) {
            hideControls();
          }
        }
      });

    return Gesture.Exclusive(tap, pan);
  }, []);

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

  const expandedPlayStyle = useAnimatedStyle(() => {
    const expandFactor = interpolate(mvHeight.value, [MV_COLLAPSED, MV_COLLAPSED + 50, MV_EXPANDED], [0, 0, 1], 'clamp');
    return { opacity: expandFactor * controlsVisible.value };
  });

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

  // Stable ref so the play-button gesture worklet always calls the latest togglePlayPause
  const togglePlayPauseRef = useRef(togglePlayPause);
  togglePlayPauseRef.current = togglePlayPause;
  const stableTogglePlayPause = useCallback(() => {
    togglePlayPauseRef.current();
  }, []);

  const playButtonTap = useMemo(() =>
    Gesture.Tap().onEnd(() => {
      'worklet';
      cancelAnimation(controlsVisible);
      controlsVisible.value = withTiming(1, { duration: CONTROLS_FADE }, (finished) => {
        if (finished) {
          controlsVisible.value = withDelay(
            CONTROLS_HIDE_DELAY,
            withTiming(0, { duration: CONTROLS_FADE }, (f2) => {
              if (f2) runOnJS(setControlsShown)(false);
            }),
          );
        }
      });
      runOnJS(stableTogglePlayPause)();
    }),
    [],
  );

  const handleTokenPress = useCallback((token: Token, lineText: string, koreanLyrics: string | null) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    setSelectedKoreanLine(koreanLyrics);
    resetLookup();
    getWord(token.baseForm);
    wordSheetRef.current?.expand();
  }, [resetLookup, getWord]);

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
      vocabAddWord(selectedToken, song.id, selectedLine, selectedKoreanLine);
    }
  };

  const handleEditAndSave = () => {
    if (selectedToken) {
      setWordEditVisible(true);
    }
  };

  const handleEditSaved = useCallback(() => {
    setWordEditVisible(false);
    if (selectedToken) {
      resetLookup();
      getWord(selectedToken.baseForm);
    }
  }, [selectedToken, resetLookup, getWord]);

  const handleCloseWordEdit = useCallback(() => {
    setWordEditVisible(false);
  }, []);

  const handleEditWord = () => {
    if (existingWord) {
      wordSheetRef.current?.close();
      navigation.navigate('EditWord', {
        mode: 'edit',
        wordId: existingWord.id,
        japanese: existingWord.japanese,
        reading: existingWord.reading ?? undefined,
        meanings: existingWord.meanings,
      });
    }
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteWord = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteWord = async () => {
    if (existingWord) {
      try {
        await wordApi.deleteWord(existingWord.id);
        resetLookup();
        if (selectedToken) {
          getWord(selectedToken.baseForm);
        }
        setShowDeleteDialog(false);
      } catch {
        setShowDeleteDialog(false);
      }
    }
  };

  const hasAnalyzedTokens = useMemo(
    () => studyUnits.some(u => u.tokens.some(t => t.koreanText != null)),
    [studyUnits],
  );

  const handleOpenWordList = useCallback(() => {
    resetBatchAdd();
    setWordListVisible(true);
  }, []);

  const handleBatchSave = useCallback((words: AddWordRequest[]) => {
    batchAddWords(words);
  }, []);

  const handleCloseWordList = useCallback(() => {
    setWordListVisible(false);
  }, []);

  const isTranslationPending = useMemo(
    () => studyUnits.length > 0
      && studyUnits.some(u => u.originalText.trim() !== '')
      && studyUnits.every(u => u.koreanLyrics === null),
    [studyUnits],
  );

  const currentLineIndex = useMemo(
    () => isSynced
      ? studyUnits.reduce((acc, unit, idx) => {
          if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
          return acc;
        }, 0)
      : -1,
    [isSynced, studyUnits, currentMs],
  );

  currentLineIndexRef.current = currentLineIndex;
  isPlayingRef.current = isPlaying;
  isSyncedRef.current = isSynced;

  const shouldShowScrollBtn = isSynced && isPlaying && currentLineIndex >= 0
    && !followModeRef.current
    && !visibleIndicesRef.current.has(currentLineIndex);

  useEffect(() => {
    if (shouldShowScrollBtn !== prevScrollBtnShown.current) {
      prevScrollBtnShown.current = shouldShowScrollBtn;
      scrollBtnVisible.value = withTiming(shouldShowScrollBtn ? 1 : 0, { duration: 200 });
    }
  }, [shouldShowScrollBtn]);

  useEffect(() => {
    if (initialSeekMs != null && durationMs > 0 && !initialSeekDone.current) {
      initialSeekDone.current = true;
      youtubeRef.current?.seekTo(initialSeekMs / 1000);
      setCurrentMs(initialSeekMs);
    }
  }, [durationMs, initialSeekMs]);

  useEffect(() => {
    if (initialLyricIndex == null || initialScrollDone.current) return;
    if (studyUnits.length <= initialLyricIndex) return;
    initialScrollDone.current = true;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialLyricIndex,
        animated: false,
        viewPosition: 0.3,
      });
      prevAutoScrollLineRef.current = initialLyricIndex;
    }, 100);
    return () => clearTimeout(timer);
  }, [initialLyricIndex, studyUnits]);

  // Auto-scroll: follow mode
  useEffect(() => {
    if (followModeRef.current && isSynced && isPlaying && currentLineIndex >= 0
        && currentLineIndex !== prevAutoScrollLineRef.current) {
      prevAutoScrollLineRef.current = currentLineIndex;
      scrollToCurrentLine();
    }
  }, [currentLineIndex, isSynced, isPlaying, scrollToCurrentLine]);

  // Reset follow mode when song changes
  useEffect(() => {
    followModeRef.current = true;
    prevAutoScrollLineRef.current = -1;
  }, [studyData]);

  const scrollBtnDirection = useMemo(() => {
    if (!shouldShowScrollBtn || visibleIndicesRef.current.size === 0) return 'down';
    const minVisible = Math.min(...visibleIndicesRef.current);
    return currentLineIndex < minVisible ? 'up' : 'down';
  }, [shouldShowScrollBtn, currentLineIndex]);

  const handleRefreshLyrics = async () => {
    try {
      const data = await songApi.getById(song.id);
      usePlayerStore.setState({ studyData: data });
    } catch {}
  };

  const renderLyricLine = ({ item, index }: { item: StudyUnit; index: number }) => (
    <LyricLine
      studyUnit={item}
      isActive={!isSynced || index === currentLineIndex}
      onTokenPress={handleTokenPress}
      onLineSeek={isSynced ? handleSeek : undefined}
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
        <Animated.View style={[styles.mvExpandedPlayOverlay, expandedPlayStyle]} pointerEvents={controlsShown ? "box-none" : "none"}>
          <GestureDetector gesture={playButtonTap}>
            <Animated.View style={styles.mvPlayBtn}>
              <Feather name={isPlaying ? 'pause' : 'play'} size={24} color="#FFFFFF" />
            </Animated.View>
          </GestureDetector>
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
              ref={flatListRef}
              data={studyUnits}
              keyExtractor={(item) => String(item.index)}
              renderItem={renderLyricLine}
              initialNumToRender={studyUnits.length}
              onScrollBeginDrag={handleScrollBeginDrag}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig.current}
              ListHeaderComponent={
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                  <View style={styles.songActionRow}>
                    {hasAnalyzedTokens && (
                      <TouchableOpacity
                        style={styles.wordListBtn}
                        onPress={handleOpenWordList}
                        activeOpacity={0.7}
                      >
                        <Feather name="list" size={16} color={Colors.primary} />
                        <Text style={styles.wordListBtnText}>전체 단어 담기</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deckBtn}
                      onPress={() => navigation.navigate('DeckDetail', { songId: song.id })}
                      activeOpacity={0.7}
                    >
                      <Feather name="layers" size={16} color={Colors.textSecondary} />
                      <Text style={styles.deckBtnText}>덱 보기</Text>
                    </TouchableOpacity>
                  </View>
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
            <Animated.View
              style={[styles.scrollToLineBtn, scrollBtnAnimStyle]}
              pointerEvents={shouldShowScrollBtn ? 'auto' : 'none'}
            >
              <TouchableOpacity onPress={handleScrollBtnPress} activeOpacity={0.6} style={styles.scrollToLineBtnInner}>
                <Feather name={scrollBtnDirection === 'up' ? 'chevron-up' : 'chevron-down'} size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
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
              addStatus={addStatus}
              getWordStatus={getWordStatus}
              existingWord={existingWord}
              songId={song.id}
              lyricLine={selectedLine}
              onAddWord={handleAddWord}
              onEditAndSave={handleEditAndSave}
              onEditWord={handleEditWord}
              onDeleteWord={handleDeleteWord}
            />
          )}
        </BottomSheetView>
      </BottomSheet>

      <AppDialog
        visible={showDeleteDialog}
        title="단어장에서 뺄까요?"
        body={'이 단어의 뜻, 예문, 플래시카드가\n모두 삭제돼요.'}
        buttons={[
          { label: '취소', variant: 'secondary', onPress: () => setShowDeleteDialog(false) },
          { label: '빼기', variant: 'danger', onPress: confirmDeleteWord },
        ]}
      />
    </SafeAreaView>

      {/* Song word list sheet */}
      <SongWordListSheet
        visible={wordListVisible}
        studyUnits={studyUnits}
        songId={song.id}
        batchAddStatus={batchAddStatus}
        batchSavedCount={batchSavedCount}
        batchSkippedCount={batchSkippedCount}
        onSave={handleBatchSave}
        onClose={handleCloseWordList}
      />

      {/* Word edit sheet */}
      <WordEditSheet
        visible={wordEditVisible}
        token={selectedToken}
        songId={song.id}
        lyricLine={selectedLine}
        koreanLyricLine={selectedKoreanLine ?? undefined}
        onSaved={handleEditSaved}
        onClose={handleCloseWordEdit}
      />
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
  mvExpandedPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mvPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00000080',
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
  songActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  wordListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.primary + '12',
  },
  wordListBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  deckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
  },
  deckBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
  scrollToLineBtn: {
    position: 'absolute',
    bottom: 48,
    right: 16,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  scrollToLineBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
