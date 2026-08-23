import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { WordSense, sensesFromMeaningText } from '../types/word';
import WordFormFields from '../components/WordFormFields';
import PosPickerList from '../components/PosPickerList';
import { wordApi } from '../api/wordApi';
import { useWordForm } from '../hooks/useWordForm';
import AppDialog from '../components/AppDialog';
import ErrorDialog from '../components/ErrorDialog';
import { AppBar } from '../components/AppBar';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppSheetHandoffScrollView } from '../components/bottomSheet';
import { Colors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditWord'>;

export default function EditWordScreen({ route, navigation }: Props) {
  const {
    mode, wordId, japanese, reading: initReading, senses: initSenses,
    token, songId, lyricLine, lyricLineIndex, koreanLyricLine,
  } = route.params;

  const japaneseText = mode === 'edit' ? japanese! : token!.baseForm;
  const initialReadingValue = mode === 'edit' ? (initReading ?? '') : (token!.baseFormReading ?? token!.reading ?? '');
  // 곡이 준 뜻은 쉼표로 이어진 문자열 하나다 — 저장되는 모양 그대로 뜻마다 한 줄씩 편집하게 한다.
  const initialSensesValue: WordSense[] = mode === 'edit'
    ? (initSenses ?? []).map(s => ({ ...s, examples: [...(s.examples ?? [])] }))
    : (() => {
        const partOfSpeech = token!.partOfSpeech ?? '명사';
        const examples = songId != null && lyricLine
          ? [{
              text: lyricLine,
              translation: koreanLyricLine ?? null,
              songId,
              lineIndex: lyricLineIndex ?? null,
            }]
          : [];
        const senses = sensesFromMeaningText(token!.koreanText, partOfSpeech, examples);
        return senses.length > 0 ? senses : [{ meaning: '', partOfSpeech, jlpt: null, examples }];
      })();

  const form = useWordForm(initialReadingValue, initialSensesValue);

  const [saving, setSaving] = useState(false);
  const [posPickerIndex, setPosPickerIndex] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const posSheetRef = useRef<AppBottomSheetModalRef>(null);
  const insets = useSafeAreaInsets();
  const windowHeight = useWindowDimensions().height;
  // 품사 14개는 화면보다 길다 — 시트가 화면을 다 먹지 않게 상한을 둔다.
  const maxSheetHeight = useMemo(
    () => (windowHeight - insets.top) * 0.8,
    [windowHeight, insets.top],
  );

  // Initial snapshot for change detection
  const initialSnapshot = useRef(
    JSON.stringify({
      reading: initialReadingValue,
      senses: initialSensesValue,
    }),
  ).current;

  // 예문 삭제도 senses 안에서 일어나므로 스냅샷 하나로 전부 잡힌다.
  const hasChanges = useMemo(() => {
    return JSON.stringify({ reading: form.reading, senses: form.senses }) !== initialSnapshot;
  }, [form.reading, form.senses, initialSnapshot]);

  // 읽기·뜻이 바뀌면 복습 진도 초기화를 물어보지만, 예문만 지운 경우는 묻지 않는다.
  const hasWordChanges = useMemo(() => {
    const strip = (senses: WordSense[]) => senses.map(s => ({ meaning: s.meaning, partOfSpeech: s.partOfSpeech }));
    return JSON.stringify({ reading: form.reading, senses: strip(form.senses) })
      !== JSON.stringify({ reading: initialReadingValue, senses: strip(initialSensesValue) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.reading, form.senses]);

  const canSave = !form.hasEmptyMeaning && form.senses.length > 0 && !saving;

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
    posSheetRef.current?.present();
  };

  const handleSave = async (resetFlashcard: boolean = false) => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === 'edit') {
        // senses 는 전체 replace — 뜻 추가·삭제와 예문 삭제가 이 한 번의 호출로 반영된다.
        await wordApi.updateWord(wordId!, {
          reading: form.reading || null,
          senses: form.senses,
          resetFlashcard,
        });
      } else {
        await wordApi.addWord({
          japanese: japaneseText,
          reading: form.reading,
          senses: form.senses,
          songId,
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
        <AppBar
          title={mode === 'createAndEdit' ? '수정하고 담기' : '단어 수정'}
          onBack={confirmGoBack}
        />

        {/* Content */}
        <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" extraScrollHeight={80} enableOnAndroid>
          <WordFormFields
            japaneseText={japaneseText}
            reading={form.reading}
            onReadingChange={form.setReading}
            senses={form.senses}
            onMeaningTextChange={form.updateMeaningText}
            onMeaningBlur={form.markTouched}
            onRemoveMeaning={form.removeMeaning}
            onOpenPosPicker={openPosPicker}
            onAddMeaning={form.addMeaning}
            shouldShowError={form.shouldShowError}
            showExamples={mode === 'edit'}
            onRemoveExample={form.removeExample}
          />
        </KeyboardAwareScrollView>

        {/* Save button — 스크롤과 분리된 하단 고정 영역 */}
        <View style={styles.saveArea}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSavePress}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* POS Picker — 다른 picker 들과 같이 modal 로 띄운다. non-modal sheet 는 닫혀 있어도
          화면 위에 backdrop 이 상주해서 폼 터치를 먹는다. topInset 으로 status bar 는 비워 둔다. */}
      <AppBottomSheetModal
        ref={posSheetRef}
        topInset={insets.top}
        maxDynamicContentSize={maxSheetHeight}
        enableDynamicSizing
        enablePanDownToClose
        onDismiss={() => setPosPickerIndex(null)}
      >
        <AppSheetHandoffScrollView contentContainerStyle={styles.pickerContent}>
          <PosPickerList
            selectedPos={posPickerIndex !== null ? form.senses[posPickerIndex]?.partOfSpeech : null}
            onSelect={(pos) => {
              if (posPickerIndex !== null) form.updateMeaningPos(posPickerIndex, pos);
              posSheetRef.current?.dismiss();
            }}
          />
        </AppSheetHandoffScrollView>
      </AppBottomSheetModal>

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

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20, gap: 32 },

  // Save
  saveArea: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  saveBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primaryShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  saveBtnDisabled: { backgroundColor: Colors.elevated, shadowOpacity: 0, elevation: 0 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  saveBtnTextDisabled: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

  // POS Picker — sheet chrome(배경·radius·drag bar)은 AppBottomSheetModal 이 갖는다.
  pickerContent: { paddingBottom: 8 },
});
