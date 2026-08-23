import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WordSense } from '../types/word';
import { getPosLabel, getPosColor } from '../types/pos';
import ArtworkImage from './ArtworkImage';
import { Colors } from '../theme/theme';

interface Props {
  japaneseText: string;
  reading: string;
  onReadingChange: (text: string) => void;
  senses: WordSense[];
  onMeaningTextChange: (index: number, text: string) => void;
  onMeaningBlur: (index: number) => void;
  onRemoveMeaning: (index: number) => void;
  onOpenPosPicker: (index: number) => void;
  onAddMeaning: () => void;
  shouldShowError: (index: number) => boolean;
  /** 예문은 뜻에 붙어 있으므로 뜻 항목 안에서 편집한다. */
  showExamples?: boolean;
  onRemoveExample?: (senseIndex: number, exampleIndex: number) => void;
}

export default function WordFormFields({
  japaneseText,
  reading,
  onReadingChange,
  senses,
  onMeaningTextChange,
  onMeaningBlur,
  onRemoveMeaning,
  onOpenPosPicker,
  onAddMeaning,
  shouldShowError,
  showExamples = false,
  onRemoveExample,
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

      {/* Meanings — 뜻마다 번호 배지를 달고, 그 뜻의 예문을 바로 아래에 들여쓴다. */}
      <View style={styles.meanSection}>
        <Text style={styles.sectionLabel}>뜻</Text>
        {senses.map((m, i) => {
          const posColor = getPosColor(m.partOfSpeech);
          const showError = shouldShowError(i);
          const examples = m.examples ?? [];
          return (
            <View key={i}>
              <View style={styles.meaningRow}>
                <View style={styles.numBadge}>
                  <Text style={styles.numBadgeText}>{i + 1}</Text>
                </View>

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
                    value={m.meaning}
                    onChangeText={(t) => onMeaningTextChange(i, t)}
                    onBlur={() => onMeaningBlur(i)}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => onRemoveMeaning(i)}
                  hitSlop={8}
                  disabled={senses.length <= 1}
                >
                  <Feather name="x" size={16} color={senses.length <= 1 ? Colors.border : Colors.textMuted} />
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

              {showExamples && examples.length > 0 && (
                <View style={styles.exampleList}>
                  {examples.map((ex, j) => (
                    <View key={j} style={styles.exampleRow}>
                      <View style={styles.exampleContent}>
                        <Text style={styles.exampleJp}>{ex.text}</Text>
                        {ex.translation != null && <Text style={styles.exampleKr}>{ex.translation}</Text>}
                        {ex.songTitle != null && (
                          <View style={styles.exampleSongRow}>
                            <ArtworkImage url={ex.artworkUrl ?? null} size={14} cornerRadius={3} />
                            <Text style={styles.exampleSong}>{ex.songTitle}</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => onRemoveExample?.(i, j)} hitSlop={8}>
                        <Feather name="x" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
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
  jpArea: { alignItems: 'center', gap: 6, paddingTop: 24, paddingBottom: 8 },
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

  meanSection: { gap: 20 },

  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  numBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
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
  meaningInputError: { borderBottomColor: Colors.accentRed },
  meaningInput: {
    fontSize: 17,
    color: Colors.textPrimary,
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 30,
  },
  errorText: { fontSize: 12, color: Colors.accentRed },

  exampleList: {
    gap: 16,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 34,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exampleContent: { flex: 1, gap: 3 },
  exampleJp: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  exampleKr: { fontSize: 12, color: Colors.textMuted },
  exampleSongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  exampleSong: { fontSize: 11, color: Colors.textMuted },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  addText: { fontSize: 15, fontWeight: '500', color: Colors.primary },
});
