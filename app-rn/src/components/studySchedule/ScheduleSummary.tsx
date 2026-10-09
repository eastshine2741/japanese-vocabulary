import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
}

/** 오늘 목록 요약 — 몇 장인지, 어떻게 골랐는지. */
export const ScheduleSummary = React.memo(function ScheduleSummary({
  dueToday,
  newToday,
  studiedCards,
  previewWords,
}: Props) {
  const restCount = Math.max(0, dueToday - previewWords.length);
  const pickLine = selectionLine(dueToday, newToday, studiedCards);
  const previewLine = previewWords.map(word => word.japanese).join(' · ');

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

      <View style={styles.sub}>
        {pickLine != null && <Text style={styles.pickLine}>{pickLine}</Text>}
        {previewWords.length > 0 && (
          <Text style={styles.previewLine} numberOfLines={1}>
            {previewLine}
            {restCount > 0 ? ` 외 ${restCount}개` : ''}
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hero: {
    gap: 10,
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
  sub: {
    gap: 3,
  },
  pickLine: {
    ...Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  previewLine: {
    ...Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
