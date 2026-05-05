import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/playerStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { songApi } from '../api/songApi';
import { wordApi } from '../api/wordApi';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import WordEditSheet from '../components/WordEditSheet';
import WordStudySheet from '../components/WordStudySheet';
import LyricsDial from '../components/LyricsDial';
import ActionChips from '../components/ActionChips';
import MiniBanner from '../components/MiniBanner';
import AppDialog from '../components/AppDialog';
import { Token } from '../types/song';
import { AddWordRequest } from '../types/word';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

const MV_HEIGHT = 200;
const APP_BAR_HEIGHT = 56;
const SHEET_PEEK = 76;
const SHEET_MID = 316;

// MV translates upward as the sheet rises so it tucks behind the app bar
// (matches the 6 → 6a transition where MV slides under the gradient app bar).
const MV_TRANSLATE_MID = -APP_BAR_HEIGHT;
const MV_TRANSLATE_FULL = -(APP_BAR_HEIGHT + MV_HEIGHT);

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

  // Playback state
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Word lookup state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedKoreanLine, setSelectedKoreanLine] = useState<string | null>(null);
  const [wordEditVisible, setWordEditVisible] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);


  // Sheet snap index — drives wordSheet collapsed/expanded variants and overlay layers
  const [snapIndex, setSnapIndex] = useState(0);

  // For non-synced songs we step through lines manually (no MV time to lean on)
  const [manualLineIndex, setManualLineIndex] = useState(0);

  // Refs
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordLookupRef = useRef<BottomSheet>(null);
  const wordStudyRef = useRef<BottomSheet>(null);
  const initialSeekDone = useRef(false);
  const initialIndexApplied = useRef(false);

  const animatedIndex = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom;

  const handleBack = useCallback(() => {
    resetPlayer();
    navigation.goBack();
  }, [resetPlayer, navigation]);

  // ----- Animated styles tied to sheet position -----
  // The full mid-layer (MV + song info + chips + lyrics) translates uniformly:
  // peek (0) → 0, mid (1) → MV slides up under app bar, full (2) → off-screen.
  const midLayerStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(
        animatedIndex.value,
        [0, 1, 2],
        [0, MV_TRANSLATE_MID, MV_TRANSLATE_FULL],
        Extrapolation.CLAMP,
      ),
    }],
    opacity: interpolate(animatedIndex.value, [1.4, 2], [1, 0], Extrapolation.CLAMP),
  }));

  // Mini banner cross-fades in at full expansion (6 → 6b)
  const miniBannerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [1.4, 2], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(animatedIndex.value, [1.4, 2], [-12, 0], Extrapolation.CLAMP),
    }],
  }));

  // App bar fades out at full so the mini banner replaces it cleanly
  const appBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [1.4, 2], [1, 0], Extrapolation.CLAMP),
  }));

  // Bail until study data is loaded (rest of file uses studyData fields)
  if (!studyData) return null;

  const { song, studyUnits, youtubeUrl } = studyData;
  const isSynced = song.lyricType === 'SYNCED';
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  // ----- YouTube callbacks -----
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

  // ----- Lyric word tap -----
  const handleTokenPress = useCallback((token: Token, lineText: string, koreanLyrics: string | null) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    setSelectedKoreanLine(koreanLyrics);
    resetLookup();
    getWord(token.baseForm);
    wordLookupRef.current?.expand();
  }, [resetLookup, getWord]);

  // ----- Action chip handlers -----
  const onOpenVocab = useCallback(() => {
    navigation.navigate('DeckDetail', { songId: song.id });
  }, [navigation, song.id]);

  // ----- Word lookup actions -----
  const handleAddWord = useCallback(() => {
    if (selectedToken) {
      vocabAddWord(selectedToken, song.id, selectedLine, selectedKoreanLine);
    }
  }, [selectedToken, song.id, selectedLine, selectedKoreanLine, vocabAddWord]);

  const handleEditAndSave = useCallback(() => {
    if (selectedToken) setWordEditVisible(true);
  }, [selectedToken]);

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

  const handleEditWord = useCallback(() => {
    if (existingWord) {
      wordLookupRef.current?.close();
      navigation.navigate('EditWord', {
        mode: 'edit',
        wordId: existingWord.id,
        japanese: existingWord.japanese,
        reading: existingWord.reading ?? undefined,
        meanings: existingWord.meanings,
      });
    }
  }, [existingWord, navigation]);

  const handleDeleteWord = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteWord = useCallback(async () => {
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
  }, [existingWord, resetLookup, selectedToken, getWord]);

  // ----- Bulk save (called by WordStudySheet) -----
  const handleBatchSave = useCallback((words: AddWordRequest[]) => {
    batchAddWords(words);
  }, [batchAddWords]);

  // Track sheet snap index: drives collapsed peek view + bulk-add reset
  const handleSheetChange = useCallback((index: number) => {
    setSnapIndex(index);
    if (index === 2) resetBatchAdd();
  }, [resetBatchAdd]);

  // ----- Lyric sync -----
  const isTranslationPending = useMemo(
    () => studyUnits.length > 0
      && studyUnits.some(u => u.originalText.trim() !== '')
      && studyUnits.every(u => u.koreanLyrics === null),
    [studyUnits],
  );

  const syncedLineIndex = useMemo(
    () => isSynced
      ? studyUnits.reduce((acc, unit, idx) => {
          if (unit.startTimeMs != null && unit.startTimeMs <= currentMs) return idx;
          return acc;
        }, 0)
      : 0,
    [isSynced, studyUnits, currentMs],
  );

  const displayLineIndex = isSynced ? syncedLineIndex : manualLineIndex;

  // Initial seek + initial line (from route params).
  // Waits for durationMs > 0 so the YouTube iframe is loaded before seekTo runs.
  useEffect(() => {
    if (initialSeekMs != null && durationMs > 0 && !initialSeekDone.current) {
      initialSeekDone.current = true;
      youtubeRef.current?.seekTo(initialSeekMs / 1000);
      setCurrentMs(initialSeekMs);
    }
  }, [durationMs, initialSeekMs]);

  useEffect(() => {
    if (initialLyricIndex == null || initialIndexApplied.current) return;
    if (studyUnits.length <= initialLyricIndex) return;
    if (isSynced && durationMs <= 0) return; // wait for player ready before seek
    initialIndexApplied.current = true;
    if (!isSynced) {
      setManualLineIndex(initialLyricIndex);
    } else {
      const unit = studyUnits[initialLyricIndex];
      if (unit?.startTimeMs != null) {
        youtubeRef.current?.seekTo(unit.startTimeMs / 1000);
        setCurrentMs(unit.startTimeMs);
      }
    }
  }, [initialLyricIndex, isSynced, studyUnits, durationMs]);

  // Step-by-step lyric navigation (driven by LyricsDial swipe)
  const handleStepLine = useCallback((newIndex: number) => {
    if (isSynced) {
      const unit = studyUnits[newIndex];
      if (unit?.startTimeMs != null) {
        youtubeRef.current?.seekTo(unit.startTimeMs / 1000);
        setCurrentMs(unit.startTimeMs);
      }
    } else {
      setManualLineIndex(newIndex);
    }
  }, [isSynced, studyUnits]);

  const handleRefreshLyrics = useCallback(async () => {
    try {
      const data = await songApi.getById(song.id);
      usePlayerStore.setState({ studyData: data });
    } catch {}
  }, [song.id]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  const wordStudySnapPoints = useMemo<(string | number)[]>(
    () => [SHEET_PEEK, SHEET_MID, '88%'],
    [],
  );

  const isCollapsedPeek = snapIndex <= 0;


  return (
    <View style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        {/* Mid layer: MV + song info + action chips + lyrics dial */}
        <Animated.View
          style={[styles.midLayer, midLayerStyle]}
          pointerEvents={snapIndex === 2 ? 'none' : 'box-none'}
        >
          {/* MV banner */}
          <View style={styles.mvWrap}>
            {videoId ? (
              <YouTubePlayer
                ref={youtubeRef}
                videoId={videoId}
                height={MV_HEIGHT}
                onTimeChange={handleTimeChange}
                onDurationChange={handleDurationChange}
                onStateChange={handleStateChange}
              />
            ) : (
              <View style={styles.mvPlaceholder}>
                <Feather name="play" size={32} color="#FFFFFF80" />
              </View>
            )}
          </View>

          {/* Song info */}
          <View style={styles.songInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
              <Feather name="chevron-right" size={18} color={Colors.textPrimary} />
            </View>
            <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
          </View>

          {/* Notices */}
          {isTranslationPending && (
            <View style={styles.notice}>
              <View style={styles.noticeIconWrap}>
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
              <View style={styles.noticeIconWrap}>
                <Feather name="music" size={18} color={Colors.textMuted} />
              </View>
              <View style={styles.noticeTextWrap}>
                <Text style={styles.noticeMain}>이 노래는 싱크 가사가 없어요</Text>
                <Text style={styles.noticeSub}>스와이프로 라인을 옮기며 학습하세요</Text>
              </View>
            </View>
          )}

          {/* Action chips */}
          <ActionChips onOpenVocab={onOpenVocab} />

          {/* Step-by-step lyrics dial — active line stays centered, swipe to step */}
          <LyricsDial
            studyUnits={studyUnits}
            currentLineIndex={displayLineIndex}
            showTranslation={true}
            onTokenPress={handleTokenPress}
            onStepLine={handleStepLine}
          />

        </Animated.View>

        {/* App bar (always at top below status bar) */}
        <Animated.View
          style={[styles.appBar, { top: insets.top }, appBarStyle]}
          pointerEvents={snapIndex === 2 ? 'none' : 'box-none'}
        >
          <TouchableOpacity onPress={handleBack} hitSlop={8} activeOpacity={0.6}>
            <Feather name="chevron-down" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8} activeOpacity={0.6}>
            <Feather name="more-vertical" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Mini banner — fades in at full expansion (replaces app bar + MV) */}
        <Animated.View
          style={[styles.miniBannerWrap, { top: insets.top }, miniBannerStyle]}
          pointerEvents={snapIndex === 2 ? 'box-none' : 'none'}
        >
          <MiniBanner
            title={song.title}
            artist={song.artist}
            isPlaying={isPlaying}
            onTogglePlay={togglePlayPause}
          />
        </Animated.View>
      </View>

      {/* Word study bottom sheet — peek/mid/full. Sibling of safeArea so it covers the full container without inheriting safe-area padding.
         handleComponent={null}: the design renders the handle indicator inside the content (V2JqQC sheetPeek / N07HWp.rp8Od). It also bypasses the
         isLayoutCalculated gate that depends on handle onLayout firing — that gate fails on web/Android for non-modal sheets and pins the sheet at INITIAL_POSITION off-screen. */}
      <BottomSheet
        ref={wordStudyRef}
        snapPoints={wordStudySnapPoints}
        index={0}
        enablePanDownToClose={false}
        bottomInset={insets.bottom}
        handleComponent={null}
        animatedIndex={animatedIndex}
        onChange={handleSheetChange}
        backgroundStyle={styles.studySheetBg}
      >
        <WordStudySheet
          studyUnits={studyUnits}
          songId={song.id}
          batchAddStatus={batchAddStatus}
          batchSavedCount={batchSavedCount}
          batchSkippedCount={batchSkippedCount}
          onSave={handleBatchSave}
          collapsed={isCollapsedPeek}
        />
      </BottomSheet>

      {/* Word lookup bottom sheet — opens on word tap */}
      <BottomSheet
        ref={wordLookupRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={safeBottom + 12}
        backdropComponent={renderBackdrop}
        style={styles.lookupSheetFloat}
        backgroundStyle={styles.lookupSheetBg}
        handleStyle={styles.lookupSheetHandle}
        handleIndicatorStyle={styles.lookupSheetIndicator}
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
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },

  // Mid layer: MV + content (translates and fades with sheet)
  midLayer: {
    flex: 1,
    paddingTop: APP_BAR_HEIGHT,
    paddingBottom: SHEET_PEEK,
  },

  // App bar — pinned at top of safe area (top inset applied inline)
  appBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: APP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    zIndex: 1,
  },

  // Mini banner — pinned at top, replaces app bar at full expansion (top inset inline)
  miniBannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },

  // MV
  mvWrap: {
    width: '100%',
    height: MV_HEIGHT,
    backgroundColor: '#000',
  },
  mvPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Song info
  songInfo: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  songArtist: {
    fontSize: 13,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 24,
    marginVertical: 6,
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTextWrap: {
    flex: 1,
    gap: 2,
  },
  noticeMain: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  noticeSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  noticeRefreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Word study sheet (always visible). Border-top + iOS shadow gives a visible
  // edge against the white background; Android falls back to the border (elevation
  // creates a downward shadow which won't appear above a bottom-attached sheet).
  studySheetBg: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  // Word lookup sheet (modal-style, opens on word tap)
  lookupSheetFloat: {
    marginHorizontal: 12,
  },
  lookupSheetBg: {
    backgroundColor: Colors.card,
    borderRadius: 24,
  },
  lookupSheetHandle: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  lookupSheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
});
