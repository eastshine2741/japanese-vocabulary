import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ExampleSentence } from '../types/word';
import ArtworkImage from '../components/ArtworkImage';
import WordFormFields from '../components/WordFormFields';
import PosPickerList from '../components/PosPickerList';
import { wordApi } from '../api/wordApi';
import { useWordForm } from '../hooks/useWordForm';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import { Colors, Dimens } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditWord'>;

export default function EditWordScreen({ route, navigation }: Props) {
  const { mode, wordId, japanese, reading: initReading, meanings: initMeanings, token, songId, lyricLine, koreanLyricLine } = route.params;

  const japaneseText = mode === 'edit' ? japanese! : token!.baseForm;
  const initialReadingValue = mode === 'edit' ? (initReading ?? '') : (token!.baseFormReading ?? token!.reading ?? '');
  const initialMeaningsValue = mode === 'edit'
    ? [...initMeanings!]
    : [{ text: token!.koreanText ?? '', partOfSpeech: token!.partOfSpeech ?? '명사' }];

  const form = useWordForm(initialReadingValue, initialMeaningsValue);

  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const [deletedExampleIds, setDeletedExampleIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [posPickerIndex, setPosPickerIndex] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const posSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Initial snapshot for change detection
  const initialSnapshot = useRef(
    JSON.stringify({
      reading: initialReadingValue,
      meanings: initialMeaningsValue,
    }),
  ).current;

  const hasWordChanges = useMemo(() => {
    return JSON.stringify({ reading: form.reading, meanings: form.meanings }) !== initialSnapshot;
  }, [form.reading, form.meanings, initialSnapshot]);

  const hasChanges = useMemo(() => {
    return hasWordChanges || deletedExampleIds.size > 0;
  }, [hasWordChanges, deletedExampleIds]);

  const visibleExamples = useMemo(
    () => examples.filter((ex) => !deletedExampleIds.has(ex.id)),
    [examples, deletedExampleIds],
  );

  const canSave = !form.hasEmptyMeaning && form.meanings.length > 0 && !saving;

  // Fetch examples on mount (edit mode)
  useEffect(() => {
    if (mode === 'edit' && japaneseText) {
      wordApi.getByText(japaneseText).then((word) => {
        if (word) setExamples(word.examples);
      });
    }
  }, [mode, japaneseText]);

  const deleteExample = (exampleId: number) => {
    setDeletedExampleIds((prev) => new Set(prev).add(exampleId));
  };

  // Back guard
  const confirmGoBack = useCallback(() => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    setShowUnsavedDialog(true);
  }, [hasChanges, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showResetDialog) {
        setShowResetDialog(false);
        return true;
      }
      if (showUnsavedDialog) {
        setShowUnsavedDialog(false);
        return true;
      }
      confirmGoBack();
      return true;
    });
    return () => sub.remove();
  }, [confirmGoBack, showResetDialog, showUnsavedDialog]);

  const openPosPicker = (index: number) => {
    setPosPickerIndex(index);
    posSheetRef.current?.expand();
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />,
    [],
  );

  const handleSave = async (resetFlashcard: boolean = false) => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === 'edit') {
        await wordApi.updateWord(wordId!, {
          reading: form.reading || null,
          meanings: form.meanings,
          resetFlashcard,
          deleteExampleIds: deletedExampleIds.size > 0
            ? Array.from(deletedExampleIds)
            : undefined,
        });
      } else {
        const firstMeaning = form.meanings[0];
        await wordApi.addWord({
          japanese: japaneseText,
          reading: form.reading,
          koreanText: firstMeaning.text,
          partOfSpeech: firstMeaning.partOfSpeech,
          songId: songId!,
          lyricLine: lyricLine!,
          koreanLyricLine,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      setSaveErrorMessage('저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePress = () => {
    form.setSubmitAttempted(true);
    if (!canSave) return;
    if (mode === 'edit' && hasChanges) {
      if (hasWordChanges) {
        setShowResetDialog(true);
      } else {
        handleSave(false);
      }
    } else if (mode === 'edit' && !hasChanges) {
      navigation.goBack();
    } else {
      handleSave();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top nav */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={confirmGoBack} hitSlop={8} style={styles.navLeft}>
            <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
            <Text style={styles.navTitle}>{mode === 'createAndEdit' ? '수정하고 담기' : '단어 수정'}</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" extraScrollHeight={80} enableOnAndroid>
          <WordFormFields
            japaneseText={japaneseText}
            reading={form.reading}
            onReadingChange={form.setReading}
            meanings={form.meanings}
            onMeaningTextChange={form.updateMeaningText}
            onMeaningBlur={form.markTouched}
            onRemoveMeaning={form.removeMeaning}
            onOpenPosPicker={openPosPicker}
            onAddMeaning={form.addMeaning}
            shouldShowError={form.shouldShowError}
          />

          {/* Examples */}
          {mode === 'edit' && visibleExamples.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>예문</Text>
              {visibleExamples.map((ex, i) => (
                <View
                  key={ex.id}
                  style={[
                    styles.exampleRow,
                    i < visibleExamples.length - 1 && styles.exampleRowBorder,
                  ]}
                >
                  <View style={styles.exampleContent}>
                    <Text style={styles.exampleJp}>{ex.lyricLine}</Text>
                    <Text style={styles.exampleKr}>{ex.koreanLyricLine}</Text>
                    <View style={styles.exampleSongRow}>
                      <ArtworkImage url={ex.artworkUrl ?? null} size={14} cornerRadius={3} />
                      <Text style={styles.exampleSong}>{ex.songTitle}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteExample(ex.id)}
                    hitSlop={8}
                  >
                    <Feather name="x" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Save button */}
          <View style={styles.saveArea}>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSavePress}
              disabled={!canSave}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>

      {/* POS Picker Bottom Sheet */}
      <BottomSheet
        ref={posSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.pickerSheetBg}
        handleIndicatorStyle={styles.dragBar}
        onClose={() => setPosPickerIndex(null)}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
          <PosPickerList
            selectedPos={posPickerIndex !== null ? form.meanings[posPickerIndex]?.partOfSpeech : null}
            onSelect={(pos) => {
              if (posPickerIndex !== null) form.updateMeaningPos(posPickerIndex, pos);
              posSheetRef.current?.close();
            }}
          />
        </BottomSheetScrollView>
      </BottomSheet>

      <AppDialog
        visible={showResetDialog}
        title="복습 진도를 초기화할까요?"
        body={'단어 정보가 변경되었어요.\n복습 진도를 초기화하면 이 단어가\n새 카드로 다시 시작돼요.'}
        buttons={[
          { label: '유지하고 저장', variant: 'secondary', onPress: () => { setShowResetDialog(false); handleSave(false); } },
          { label: '초기화하고 저장', variant: 'danger', onPress: () => { setShowResetDialog(false); handleSave(true); } },
        ]}
      />

      <AppDialog
        visible={showUnsavedDialog}
        title="저장되지 않은 변경사항이 있어요"
        body="저장하지 않고 나갈까요?"
        buttons={[
          { label: '계속 수정', variant: 'secondary', onPress: () => setShowUnsavedDialog(false) },
          { label: '나가기', variant: 'danger', onPress: () => { setShowUnsavedDialog(false); navigation.goBack(); } },
        ]}
      />

      <ErrorDialog message={saveErrorMessage} onDismiss={() => setSaveErrorMessage(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },

  // Top nav
  topNav: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20, gap: 32 },

  // Sections (for examples)
  section: { gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted },

  // Examples
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  exampleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exampleContent: {
    flex: 1,
    gap: 3,
  },
  exampleJp: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  exampleKr: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  exampleSongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  exampleSong: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Save
  saveArea: { paddingTop: 16, paddingBottom: 34 },
  saveBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.elevated },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  saveBtnTextDisabled: { fontSize: 16, fontWeight: '600', color: Colors.textMuted },

  // POS Picker
  pickerSheetBg: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted },
});
