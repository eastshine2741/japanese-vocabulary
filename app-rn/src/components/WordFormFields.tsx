import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WordMeaning } from '../types/word';
import { getPosLabel, getPosColor } from '../types/pos';
import { Colors } from '../theme/theme';

interface Props {
  japaneseText: string;
  reading: string;
  onReadingChange: (text: string) => void;
  meanings: WordMeaning[];
  onMeaningTextChange: (index: number, text: string) => void;
  onMeaningBlur: (index: number) => void;
  onRemoveMeaning: (index: number) => void;
  onOpenPosPicker: (index: number) => void;
  onAddMeaning: () => void;
  shouldShowError: (index: number) => boolean;
}

export default function WordFormFields({
  japaneseText,
  reading,
  onReadingChange,
  meanings,
  onMeaningTextChange,
  onMeaningBlur,
  onRemoveMeaning,
  onOpenPosPicker,
  onAddMeaning,
  shouldShowError,
}: Props) {
  return (
    <>
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
          onChangeText={onReadingChange}
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
                  onPress={() => onOpenPosPicker(i)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.posChipText, { color: posColor }]}>{getPosLabel(m.partOfSpeech)}</Text>
                  <Feather name="chevron-down" size={12} color={posColor} />
                </TouchableOpacity>

                <View style={[styles.meaningInputWrap, showError && styles.meaningInputError]}>
                  <TextInput
                    style={styles.meaningInput}
                    value={m.text}
                    onChangeText={(t) => onMeaningTextChange(i, t)}
                    onBlur={() => onMeaningBlur(i)}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => onRemoveMeaning(i)}
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

        <TouchableOpacity style={styles.addRow} onPress={onAddMeaning} activeOpacity={0.6}>
          <Feather name="plus" size={16} color={Colors.primary} />
          <Text style={styles.addText}>뜻 추가</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  jpArea: { alignItems: 'flex-start', paddingTop: 24, paddingBottom: 8 },
  jpText: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },

  section: { gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted },

  readingInput: {
    fontSize: 18,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    paddingTop: 0,
  },

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

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  addText: { fontSize: 15, fontWeight: '500', color: Colors.primary },
});
