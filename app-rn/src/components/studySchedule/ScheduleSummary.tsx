import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { SchedulePreviewWord } from '../../types/studySchedule';
import { estimateMinutes, selectionLine } from './scheduleMath';

interface Props {
  dueToday: number;
  newToday: number;
  studiedCards: number;
  previewWords: SchedulePreviewWord[];
  onPressRule: () => void;
}

/** 오늘 목록 요약 — 몇 장인지, 어떻게 골랐는지. */
export const ScheduleSummary = React.memo(function ScheduleSummary({
  dueToday,
  newToday,
  studiedCards,
  previewWords,
  onPressRule,
}: Props) {
  const restCount = Math.max(0, dueToday - previewWords.length);
  const pickLine = selectionLine(dueToday, newToday, studiedCards);

  return (
    <View style={styles.hero}>
      <View style={styles.numRow}>
        <View style={styles.countPhrase}>
          <Text style={styles.num}>{dueToday}</Text>
          <Text style={styles.unit}>개 복습 대기</Text>
        </View>
        <View style={styles.timePill}>
          <Ionicons name="timer-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.timeTxt}>약 {estimateMinutes(dueToday)}분</Text>
        </View>
      </View>

      {pickLine != null && (
        <Pressable style={styles.pickRow} onPress={onPressRule} hitSlop={6}>
          <Text style={styles.pickLine}>{pickLine}</Text>
          <View style={styles.infoBtn}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          </View>
        </Pressable>
      )}

      {previewWords.length > 0 && (
        <View style={styles.wordPreview}>
          {previewWords.map(word => (
            <View key={word.wordId} style={styles.chip}>
              <Text style={styles.chipText}>{word.japanese}</Text>
            </View>
          ))}
          {restCount > 0 && <Text style={styles.more}>외 {restCount}개</Text>}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  hero: {
    gap: 12,
  },
  numRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countPhrase: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  num: {
    ...Typography.headingBold,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -1.5,
    color: Colors.primary,
  },
  unit: {
    ...Typography.headingBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSubtle,
  },
  timeTxt: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickLine: {
    ...Typography.bodyMedium,
    flexShrink: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSubtle,
  },
  chipText: {
    ...Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  more: {
    ...Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
