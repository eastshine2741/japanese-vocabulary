import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { DAILY_TARGET_MAX, DAILY_TARGET_MIN, estimateMinutes } from './scheduleMath';

interface Props {
  /** 지금 예보에 반영된 값. */
  value: number;
  /** 손을 뗐을 때만 올라간다 — 드래그 중에는 라벨만 따라간다. */
  onCommit: (dailyTarget: number) => void;
}

/** 하루에 몇 장씩 할지 고르는 줄. 설정의 목표와는 무관한 시뮬레이션 입력값이다. */
export const DailyTargetSlider = React.memo(function DailyTargetSlider({ value, onCommit }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const handleComplete = useCallback((next: number) => {
    const rounded = Math.round(next);
    setDraft(rounded);
    onCommit(rounded);
  }, [onCommit]);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>매일 {draft}장씩 하면</Text>
        <Text style={styles.time}>약 {estimateMinutes(draft)}분</Text>
      </View>
      <View style={styles.control}>
        <Text style={styles.bound}>{DAILY_TARGET_MIN}</Text>
        <Slider
          style={styles.slider}
          minimumValue={DAILY_TARGET_MIN}
          maximumValue={DAILY_TARGET_MAX}
          step={1}
          value={value}
          onValueChange={setDraft}
          onSlidingComplete={handleComplete}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.border}
          thumbTintColor={Platform.OS === 'android' ? Colors.primary : undefined}
        />
        <Text style={styles.bound}>{DAILY_TARGET_MAX}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  time: {
    ...Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  bound: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
});
