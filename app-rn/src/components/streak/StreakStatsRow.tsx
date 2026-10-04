import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

interface Props {
  longestStreak: number;
  totalStudyDays: number;
  freezeCount: number;
  freezeMax: number;
  onPressFreeze: () => void;
}

/** 구분선만 있는 통계 줄 — 카드로 감싸지 않는다. */
export const StreakStatsRow = React.memo(function StreakStatsRow({
  longestStreak,
  totalStudyDays,
  freezeCount,
  freezeMax,
  onPressFreeze,
}: Props) {
  return (
    <View style={styles.row}>
      <Stat value={String(longestStreak)} unit="일" label="최장 기록" />
      <View style={styles.sep} />
      <Stat value={String(totalStudyDays)} unit="일" label="총 학습일" />
      <View style={styles.sep} />
      <Stat value={String(freezeCount)} unit={`/ ${freezeMax}`} label="보유 프리즈" onPress={onPressFreeze} />
    </View>
  );
});

function Stat({
  value,
  unit,
  label,
  onPress,
}: {
  value: string;
  unit: string;
  label: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onPress && <Ionicons name="information-circle-outline" size={12} color={Colors.textSecondary} />}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.stat}>{body}</View>;
  return (
    <Pressable style={({ pressed }) => [styles.stat, pressed && styles.statPressed]} onPress={onPress} hitSlop={8}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  value: {
    ...Typography.headingExtraBold,
    fontSize: 22,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    ...Typography.bodyBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statPressed: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sep: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
});
