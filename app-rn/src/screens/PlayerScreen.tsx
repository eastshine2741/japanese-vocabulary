import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/playerStore';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { wordApi } from '../api/wordApi';
import { deckApi } from '../api/deckApi';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import WordAnalysisSheet from '../components/WordAnalysisSheet';
import WordEditSheet from '../components/WordEditSheet';
import WordListSheet from '../components/WordListSheet';
import LyricsDial from '../components/LyricsDial';
import PlayerHeader from '../components/PlayerHeader';
import AppDialog from '../components/AppDialog';
import SongInfoSheet from '../components/SongInfoSheet';
import { Token } from '../types/song';
import { AddWordRequest } from '../types/word';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

const MV_HEIGHT = 226;
const SHEET_PEEK = 67;

// Drag-to-dismiss tuning. The pan only activates after 20px downward (so
// short taps and small upward swipes don't move the screen). Release commits
// to dismiss when either the drag passed DISMISS_THRESHOLD_PX or the user
// flicks down faster than DISMISS_VELOCITY.
const DISMISS_ACTIVATE_PX = 20;
const DISMISS_THRESHOLD_PX = 150;
const DISMISS_VELOCITY = 1500;
const DISMISS_ANIM_MS = 220;
const SNAP_BACK_SPRING = { damping: 22, stiffness: 220, mass: 0.8 } as const;

export default function PlayerScreen({ navigation, route }: Props) {
  const initialSeekMs = route.params?.initialSeekMs;
  const initialLyricIndex = route.params?.initialLyricIndex;

  const studyData = usePlayerStore(s => s.studyData);

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

  // Word lookup state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedKoreanLine, setSelectedKoreanLine] = useState<string | null>(null);
  const [wordEditVisible, setWordEditVisible] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // wordListSheet snap index — drives WordListSheet pointerEvents + batch reset
  const [snapIndex, setSnapIndex] = useState(0);

  const [vocabDeckId, setVocabDeckId] = useState<number | null>(null);

  // For non-synced songs we step through lines manually (no MV time to lean on)
  const [manualLineIndex, setManualLineIndex] = useState(0);

  // Refs
  const youtubeRef = useRef<YouTubePlayerRef>(null);
  const wordLookupRef = useRef<BottomSheet>(null);
  const wordStudyRef = useRef<BottomSheet>(null);
  const songInfoRef = useRef<BottomSheet>(null);
  const initialSeekDone = useRef(false);
  const initialIndexApplied = useRef(false);

  const wordListAnimIndex = useSharedValue(0);
  // Drag-to-dismiss: how many pixels the body is currently translated down.
  const dragY = useSharedValue(0);

  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  if (!studyData) return null;

  const { song, studyUnits, youtubeUrl, lyricsSourceName, lyricsSourceUrl } = studyData;
  const isSynced = song.lyricType === 'SYNCED';
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  // ----- YouTube callbacks -----
  const handleTimeChange = useCallback((seconds: number) => {
    setCurrentMs(seconds * 1000);
  }, []);

  const handleDurationChange = useCallback((seconds: number) => {
    if (seconds > 0) setDurationMs(seconds * 1000);
  }, []);

  // ----- Lyric word tap -----
  const handleTokenPress = useCallback((token: Token, lineText: string, koreanLyrics: string | null) => {
    setSelectedToken(token);
    setSelectedLine(lineText);
    setSelectedKoreanLine(koreanLyrics);
    resetLookup();
    getWord(token.baseForm);
    wordLookupRef.current?.expand();
  }, [resetLookup, getWord]);

  // ----- Action chip -----
  const onOpenVocab = useCallback(() => {
    if (vocabDeckId == null) return;
    navigation.navigate('DeckDetail', { deckId: vocabDeckId });
  }, [navigation, vocabDeckId]);

  const onOpenInfo = useCallback(() => {
    songInfoRef.current?.expand();
  }, []);

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

  // ----- Bulk save -----
  const handleBatchSave = useCallback((words: AddWordRequest[]) => {
    batchAddWords(words);
  }, [batchAddWords]);

  // wordListSheet snap: reset batch state when expanded so re-opens start fresh
  const handleWordListSnapChange = useCallback((index: number) => {
    setSnapIndex(index);
    if (index === 1) resetBatchAdd();
  }, [resetBatchAdd]);

  // ----- Lyric sync -----
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

  useEffect(() => {
    let cancelled = false;
    deckApi.getDeckBySongId(song.id)
      .then((d) => { if (!cancelled) setVocabDeckId(d?.deckId ?? null); })
      .catch(() => { if (!cancelled) setVocabDeckId(null); });
    return () => { cancelled = true; };
  }, [song.id, addStatus, batchAddStatus]);

  // Initial seek + initial line (from route params).
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
    if (isSynced && durationMs <= 0) return;
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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  // ----- Drag-to-dismiss -----
  // Pan starts on the MV + header area; LyricsDial owns the gesture inside
  // its own region (it has its own GestureDetector for line stepping), so
  // small swipes there continue to step lines.
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const dismissPan = useMemo(
    () =>
      Gesture.Pan()
        // Scalar: only activate after a clearly-downward drag of 20px+.
        // Taps and upward drags never activate, so children's native gestures
        // (YouTube iframe controls, TouchableOpacity onPress) keep working.
        .activeOffsetY(DISMISS_ACTIVATE_PX)
        // Bail out on horizontal swipes (back-swipe, chip horizontal scroll).
        .failOffsetX([-20, 20])
        .onChange((e) => {
          'worklet';
          dragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          'worklet';
          const shouldDismiss =
            e.translationY > DISMISS_THRESHOLD_PX || e.velocityY > DISMISS_VELOCITY;
          if (shouldDismiss) {
            dragY.value = withTiming(
              screenH,
              { duration: DISMISS_ANIM_MS },
              (finished) => {
                if (finished) runOnJS(handleGoBack)();
              },
            );
          } else {
            dragY.value = withSpring(0, SNAP_BACK_SPRING);
          }
        }),
    [dragY, screenH, handleGoBack],
  );

  // Race against children's native gestures: a tap (no movement) lets the
  // child win (iframe play button, header chips' onPress); a downward drag
  // past activeOffsetY lets the pan win and dismisses the screen.
  const nativeGesture = useMemo(() => Gesture.Native(), []);
  const composedGesture = useMemo(
    () => Gesture.Race(dismissPan, nativeGesture),
    [dismissPan, nativeGesture],
  );

  // Translate the entire screen (not just the body) so the wordListSheet
  // and other floating sheets travel down with the drag.
  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  // wordListSheet's max extent = below the MV.
  const sheetTopInset = insets.top + MV_HEIGHT;
  const expandedSnap = Math.max(
    SHEET_PEEK + 1,
    screenH - sheetTopInset - insets.bottom,
  );
  const wordListSnapPoints = useMemo<(string | number)[]>(
    () => [SHEET_PEEK, '100%'],
    [],
  );

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <View style={[styles.body, { paddingTop: insets.top }]}>
        {/* MV + PlayerHeader: drag-down anywhere here dismisses the screen.
            LyricsDial below has its own gesture and is intentionally outside
            this detector so its line-step swipes aren't intercepted. */}
        <GestureDetector gesture={composedGesture}>
          <View>
            <View style={styles.mvWrap}>
              {videoId ? (
                <YouTubePlayer
                  ref={youtubeRef}
                  videoId={videoId}
                  height={MV_HEIGHT}
                  onTimeChange={handleTimeChange}
                  onDurationChange={handleDurationChange}
                />
              ) : (
                <View style={styles.mvPlaceholder}>
                  <Feather name="play" size={32} color="#FFFFFF80" />
                </View>
              )}
            </View>
            <PlayerHeader
              title={song.title}
              artist={song.artist}
              onOpenVocab={onOpenVocab}
              onOpenInfo={onOpenInfo}
              vocabEnabled={vocabDeckId != null}
            />
          </View>
        </GestureDetector>

        <LyricsDial
          studyUnits={studyUnits}
          currentLineIndex={displayLineIndex}
          showTranslation={true}
          onTokenPress={handleTokenPress}
          onStepLine={handleStepLine}
        />
      </View>

      {/* Word list bottom sheet — 2 snaps: peek / expanded (below MV). */}
      <BottomSheet
        ref={wordStudyRef}
        snapPoints={wordListSnapPoints}
        index={0}
        enablePanDownToClose={false}
        enableOverDrag={false}
        topInset={sheetTopInset}
        bottomInset={insets.bottom}
        handleComponent={null}
        animatedIndex={wordListAnimIndex}
        onChange={handleWordListSnapChange}
        backgroundStyle={styles.studySheetBg}
      >
        <WordListSheet
          studyUnits={studyUnits}
          songId={song.id}
          batchAddStatus={batchAddStatus}
          batchSavedCount={batchSavedCount}
          batchSkippedCount={batchSkippedCount}
          onSave={handleBatchSave}
          animatedIndex={wordListAnimIndex}
          snapIndex={snapIndex}
          contentHeight={expandedSnap}
        />
      </BottomSheet>

      {/* Word lookup bottom sheet — opens on word tap */}
      <BottomSheet
        ref={wordLookupRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={insets.bottom + 12}
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

      {/* Song info / rights-holder report sheet */}
      <BottomSheet
        ref={songInfoRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={insets.bottom + 12}
        backdropComponent={renderBackdrop}
        style={styles.lookupSheetFloat}
        backgroundStyle={styles.lookupSheetBg}
        handleStyle={styles.lookupSheetHandle}
        handleIndicatorStyle={styles.lookupSheetIndicator}
      >
        <BottomSheetView>
          <SongInfoSheet
            songId={song.id}
            title={song.title}
            artist={song.artist}
            lyricsSourceName={lyricsSourceName}
            lyricsSourceUrl={lyricsSourceUrl}
          />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
  },
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

  // Word list sheet (always visible).
  studySheetBg: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
