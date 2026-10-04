import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { SchedulePreviewWord } from '../../types/studySchedule';
import { estimateMinutes } from './scheduleMath';

interface Props {
  dueToday: number;
  totalCards: number;
  previewWords: SchedulePreviewWord[];
  /** 오늘 치를 끝냈을 때 내일 볼 양 — 예보 1일차의 due 수. */
  tomorrowIfStudied: number;
  onPressRule: () => void;
}

/** 오늘 목록 요약 — 몇 장인지, 어떻게 골랐는지, 미루면 내일 얼마가 되는지. */
export const ScheduleSummary = React.memo(function ScheduleSummary({
  dueToday,
  totalCards,
  previewWords,
  tomorrowIfStudied,
  onPressRule,
}: Props) {
  const restCount = Math.max(0, dueToday - previewWords.length);
  const tomorrowIfSkipped = tomorrowIfStudied + dueToday;

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

      <Pressable style={styles.pickRow} onPress={onPressRule} hitSlop={6}>
        <Text style={styles.pickLine}>
          단어 {totalCards}장 중 잊어버리기 직전인 {dueToday}장만 골랐어요
        </Text>
        <View style={styles.infoBtn}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
        </View>
      </Pressable>

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

      {dueToday > 0 && (
        <TomorrowCompare ifStudied={tomorrowIfStudied} ifSkipped={tomorrowIfSkipped} extra={dueToday} />
      )}
    </View>
  );
});

const TomorrowCompare = React.memo(function TomorrowCompare({
  ifStudied,
  ifSkipped,
  extra,
}: {
  ifStudied: number;
  ifSkipped: number;
  extra: number;
}) {
  const max = Math.max(ifStudied, ifSkipped, 1);

  return (
    <View style={styles.tomorrowRow}>
      <View style={styles.warnLine}>
        <Ionicons name="warning-outline" size={15} color={Colors.warnText} />
        <Text style={styles.warnText}>오늘 미루면 내일 {extra}장을 더 공부해야 해요!</Text>
      </View>
      <CompareRow label="오늘 하면" cards={ifStudied} max={max} color={Colors.primary} />
      <CompareRow label="미루면" cards={ifSkipped} max={max} color={Colors.ratingHard} />
    </View>
  );
});

function CompareRow({
  label,
  cards,
  max,
  color,
}: {
  label: string;
  cards: number;
  max: number;
  color: string;
}) {
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareTrack}>
        <View
          style={[
            styles.compareBar,
            { backgroundColor: color, width: `${Math.max(4, (cards / max) * 100)}%` },
          ]}
        />
      </View>
      <View style={styles.compareValue}>
        <Text style={[styles.compareCards, { color }]}>{cards}장</Text>
        <Text style={styles.compareTime}>{estimateMinutes(cards)}분</Text>
      </View>
    </View>
  );
}

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
  tomorrowRow: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.ratingHardBg,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: Colors.warnBorder,
  },
  warnLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnText: {
    ...Typography.bodyBold,
    flexShrink: 1,
    fontSize: 13,
    letterSpacing: -0.2,
    color: Colors.warnText,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compareLabel: {
    ...Typography.bodySemiBold,
    width: 52,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  compareTrack: {
    flex: 1,
  },
  compareBar: {
    height: 18,
    borderRadius: 999,
  },
  compareValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compareCards: {
    ...Typography.headingBold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  compareTime: {
    ...Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textMuted,
  },
});
