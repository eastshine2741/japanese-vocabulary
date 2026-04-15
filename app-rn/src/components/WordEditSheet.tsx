import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Token } from '../types/song';
import WordFormFields from './WordFormFields';
import PosPickerList from './PosPickerList';
import { wordApi } from '../api/wordApi';
import { useWordForm } from '../hooks/useWordForm';
import { Colors } from '../theme/theme';

interface Props {
  visible: boolean;
  token: Token | null;
  songId: number;
  lyricLine: string;
  koreanLyricLine?: string;
  onSaved: () => void;
  onClose: () => void;
}

export default function WordEditSheet({
  visible,
  token,
  songId,
  lyricLine,
  koreanLyricLine,
  onSaved,
  onClose,
}: Props) {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const form = useWordForm(
    token?.baseFormReading ?? token?.reading ?? '',
    [{ text: token?.koreanText ?? '', partOfSpeech: token?.partOfSpeech ?? 'NOUN' }],
  );
  const [saving, setSaving] = useState(false);
  const [posPickerIndex, setPosPickerIndex] = useState<number | null>(null);

  // Reset state when sheet opens with a new token
  useEffect(() => {
    if (visible && token) {
      form.reset(
        token.baseFormReading ?? token.reading ?? '',
        [{ text: token.koreanText ?? '', partOfSpeech: token.partOfSpeech ?? 'NOUN' }],
      );
      setSaving(false);
      setPosPickerIndex(null);
    }
  }, [visible, token]);

  const japaneseText = token?.baseForm ?? '';
  const canSave = !form.hasEmptyMeaning && form.meanings.length > 0 && !saving;

  const openPosPicker = useCallback((index: number) => {
    Keyboard.dismiss();
    setPosPickerIndex(index);
  }, []);

  const handleSave = useCallback(async () => {
    form.setSubmitAttempted(true);
    if (!canSave || !token) return;
    setSaving(true);
    try {
      const firstMeaning = form.meanings[0];
      await wordApi.addWord({
        japanese: japaneseText,
        reading: form.reading,
        koreanText: firstMeaning.text,
        partOfSpeech: firstMeaning.partOfSpeech,
        songId,
        lyricLine,
        koreanLyricLine,
      });
      onSaved();
    } catch {
      setSaving(false);
    }
  }, [canSave, token, form.meanings, form.reading, japaneseText, songId, lyricLine, koreanLyricLine, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: safeTop }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>수정하고 담기</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.closeBtn}>
            <Feather name="x" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={80}
          enableOnAndroid
        >
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
        </KeyboardAwareScrollView>

        {/* CTA */}
        <View style={[styles.ctaArea, { paddingBottom: safeBottom + 16 }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, !canSave && styles.ctaBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.ctaBtnText, !canSave && styles.ctaBtnTextDisabled]}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* POS Picker */}
      <Modal
        visible={posPickerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPosPickerIndex(null)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setPosPickerIndex(null)}
          />
          <View style={[styles.pickerSheet, { paddingBottom: safeBottom + 8 }]}>
            <View style={styles.pickerHandle}>
              <View style={styles.pickerDragBar} />
            </View>
            <ScrollView>
              <PosPickerList
                selectedPos={posPickerIndex !== null ? form.meanings[posPickerIndex]?.partOfSpeech : null}
                onSelect={(pos) => {
                  if (posPickerIndex !== null) form.updateMeaningPos(posPickerIndex, pos);
                  setPosPickerIndex(null);
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20, gap: 32 },

  // CTA
  ctaArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaBtnDisabled: { backgroundColor: Colors.elevated },
  ctaBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  ctaBtnTextDisabled: { color: Colors.textMuted },

  // POS Picker
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  pickerHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  pickerDragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
});
