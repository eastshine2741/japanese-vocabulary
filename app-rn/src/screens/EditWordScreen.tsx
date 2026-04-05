import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  BackHandler,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RootStackParamList } from '../navigation/AppNavigator';
import { WordMeaning } from '../types/word';
import { POS_INFO } from '../types/pos';
import { wordApi } from '../api/wordApi';
import { useVocabularyStore } from '../stores/vocabularyStore';
import { Colors, Dimens } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditWord'>;

const POS_PICKER_KEYS = [
  'NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB',
  'PRONOUN', 'ADNOMINAL', 'CONJUNCTION', 'AUXILIARY_VERB',
  'PARTICLE', 'INTERJECTION', 'PREFIX', 'SUFFIX',
] as const;

const POS_OPTIONS = POS_PICKER_KEYS.map((key) => ({
  key,
  label: POS_INFO[key].korean,
  color: POS_INFO[key].color,
}));

function getPosLabel(pos: string): string {
  return POS_INFO[pos]?.korean ?? pos;
}

function getPosColor(pos: string): string {
  return POS_INFO[pos]?.color ?? Colors.textMuted;
}

export default function EditWordScreen({ route, navigation }: Props) {
  const { mode, wordId, japanese, reading: initReading, meanings: initMeanings, token, songId, lyricLine, koreanLyricLine } = route.params;

  const japaneseText = mode === 'edit' ? japanese! : token!.baseForm;
  const [reading, setReading] = useState(
    mode === 'edit' ? (initReading ?? '') : (token!.baseFormReading ?? token!.reading ?? ''),
  );
  const [meanings, setMeanings] = useState<WordMeaning[]>(
    mode === 'edit'
      ? [...initMeanings!]
      : [{ text: token!.koreanText ?? '', partOfSpeech: token!.partOfSpeech ?? '명사' }],
  );

  const [saving, setSaving] = useState(false);
  const [posPickerIndex, setPosPickerIndex] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [touchedIndices, setTouchedIndices] = useState<Set<number>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const posSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Initial snapshot for change detection
  const initialSnapshot = useRef(
    JSON.stringify({
      reading: mode === 'edit' ? (initReading ?? '') : (token!.baseFormReading ?? token!.reading ?? ''),
      meanings: mode === 'edit' ? initMeanings! : [{ text: token!.koreanText ?? '', partOfSpeech: token!.partOfSpeech ?? 'NOUN' }],
    }),
  ).current;

  const hasChanges = useMemo(() => {
    return JSON.stringify({ reading, meanings }) !== initialSnapshot;
  }, [reading, meanings, initialSnapshot]);

  const hasEmptyMeaning = useMemo(() => meanings.some((m) => m.text.trim() === ''), [meanings]);
  const canSave = !hasEmptyMeaning && meanings.length > 0 && !saving;

  const shouldShowError = (index: number) => {
    return (submitAttempted || touchedIndices.has(index)) && meanings[index]?.text.trim() === '';
  };

  const markTouched = (index: number) => {
    setTouchedIndices((prev) => new Set(prev).add(index));
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

  const updateMeaningText = (index: number, text: string) => {
    setMeanings((prev) => prev.map((m, i) => (i === index ? { ...m, text } : m)));
  };

  const updateMeaningPos = (index: number, pos: string) => {
    setMeanings((prev) => prev.map((m, i) => (i === index ? { ...m, partOfSpeech: pos } : m)));
  };

  const addMeaning = () => {
    const lastPos = meanings.length > 0 ? meanings[meanings.length - 1].partOfSpeech : 'NOUN';
    setMeanings((prev) => [...prev, { text: '', partOfSpeech: lastPos }]);
  };

  const removeMeaning = (index: number) => {
    if (meanings.length <= 1) return;
    setMeanings((prev) => prev.filter((_, i) => i !== index));
    setTouchedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  };

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
          reading: reading || null,
          meanings,
          resetFlashcard,
        });
      } else {
        const firstMeaning = meanings[0];
        await wordApi.addWord({
          japanese: japaneseText,
          reading,
          koreanText: firstMeaning.text,
          partOfSpeech: firstMeaning.partOfSpeech,
          songId: songId!,
          lyricLine: lyricLine!,
          koreanLyricLine,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('오류', '저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePress = () => {
    setSubmitAttempted(true);
    if (!canSave) return;
    if (mode === 'edit' && hasChanges) {
      setShowResetDialog(true);
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
            <Text style={styles.navTitle}>단어 수정</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" extraScrollHeight={80} enableOnAndroid>
          {/* Japanese */}
          <View style={styles.jpArea}>
            <Text style={styles.jpText}>{japaneseText}</Text>
          </View>

          {/* Reading */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>읽기</Text>
            <TextInput
              style={styles.readingInput}
              value={reading}
              onChangeText={setReading}
            />
          </View>

          {/* Meanings */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>뜻</Text>
            {meanings.map((m, i) => {
              const posColor = getPosColor(m.partOfSpeech);
              const showError = shouldShowError(i);
              return (
                <View key={i}>
                  <View style={styles.meaningRow}>
                    <TouchableOpacity
                      style={[styles.posChip, { backgroundColor: posColor + '20' }]}
                      onPress={() => openPosPicker(i)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.posChipText, { color: posColor }]}>{getPosLabel(m.partOfSpeech)}</Text>
                      <Feather name="chevron-down" size={12} color={posColor} />
                    </TouchableOpacity>

                    <View style={[styles.meaningInputWrap, showError && styles.meaningInputError]}>
                      <TextInput
                        style={styles.meaningInput}
                        value={m.text}
                        onChangeText={(t) => updateMeaningText(i, t)}
                        onBlur={() => markTouched(i)}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => removeMeaning(i)}
                      hitSlop={8}
                      disabled={meanings.length <= 1}
                    >
                      <Feather name="x" size={16} color={meanings.length <= 1 ? Colors.border : Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {showError && (
                    <View style={styles.errorRow}>
                      <View style={[styles.posChip, { opacity: 0 }]}>
                        <Text style={styles.posChipText}>{getPosLabel(m.partOfSpeech)}</Text>
                        <Feather name="chevron-down" size={12} />
                      </View>
                      <Text style={styles.errorText}>뜻을 입력해주세요</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.addRow} onPress={addMeaning} activeOpacity={0.6}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addText}>뜻 추가</Text>
            </TouchableOpacity>
          </View>

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
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>품사 선택</Text>
        </View>
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
          {POS_OPTIONS.map(({ key, label }) => {
            const isSelected = posPickerIndex !== null && meanings[posPickerIndex]?.partOfSpeech === key;
            return (
              <TouchableOpacity
                key={key}
                style={styles.pickerItem}
                onPress={() => {
                  if (posPickerIndex !== null) {
                    updateMeaningPos(posPickerIndex, key);
                  }
                  posSheetRef.current?.close();
                }}
                activeOpacity={0.6}
              >
                <Text style={[styles.pickerItemText, isSelected && { color: Colors.primary, fontWeight: '600' }]}>
                  {label}
                </Text>
                {isSelected && <Feather name="check" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Reset Flashcard Dialog */}
      <Modal visible={showResetDialog} transparent animationType="fade" onRequestClose={() => setShowResetDialog(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>복습 진도를 초기화할까요?</Text>
            <Text style={styles.dialogBody}>
              단어 정보가 변경되었어요.{'\n'}
              복습 진도를 초기화하면 이 단어가{'\n'}
              새 카드로 다시 시작돼요.
            </Text>
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnSecondary]}
                onPress={() => {
                  setShowResetDialog(false);
                  handleSave(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogBtnSecondaryText}>유지하고 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnDanger]}
                onPress={() => {
                  setShowResetDialog(false);
                  handleSave(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogBtnDangerText}>초기화하고 저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unsaved Changes Dialog */}
      <Modal visible={showUnsavedDialog} transparent animationType="fade" onRequestClose={() => setShowUnsavedDialog(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>저장되지 않은 변경사항이 있어요</Text>
            <Text style={styles.dialogBody}>저장하지 않고 나갈까요?</Text>
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnSecondary]}
                onPress={() => setShowUnsavedDialog(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogBtnSecondaryText}>계속 수정</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnDanger]}
                onPress={() => {
                  setShowUnsavedDialog(false);
                  navigation.goBack();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogBtnDangerText}>나가기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Japanese
  jpArea: { alignItems: 'flex-start', paddingTop: 24, paddingBottom: 8 },
  jpText: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },

  // Sections
  section: { gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted },

  // Reading
  readingInput: {
    fontSize: 18,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    paddingTop: 0,
  },

  // Meaning rows
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  posChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  posChipText: { fontSize: 12, fontWeight: '600' },

  meaningInputWrap: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
    paddingTop: 6,
  },
  meaningInputError: { borderBottomColor: '#EF4444' },
  meaningInput: {
    fontSize: 17,
    color: Colors.textPrimary,
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { fontSize: 12, color: '#EF4444' },

  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  addText: { fontSize: 15, fontWeight: '500', color: Colors.primary },

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
  pickerHeader: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  pickerItemText: { fontSize: 15, color: Colors.textPrimary },

  // Reset dialog
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: {
    width: 320,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 28,
    paddingBottom: 20,
    gap: 16,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  dialogBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBtnSecondary: { backgroundColor: Colors.elevated },
  dialogBtnSecondaryText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  dialogBtnDanger: { backgroundColor: '#EF4444' },
  dialogBtnDangerText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
