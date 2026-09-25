import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../theme/theme';
import { Typography } from '../theme/typography';

const SEGMENT_GAP = 2;
const LEGEND_DOT_SIZE = 7;

export interface MemoryProgressBarProps {
  totalCount: number;
  /** 장기기억 — 7일 뒤 90% 이상 회상. 서버가 `stability >= 7일` 로 판정해 내려준다. */
  longTermCount: number;
  /** 단기기억 — 한 번이라도 리뷰했으나 장기기억이 아닌 단어. */
  shortTermCount: number;
  showLegend?: boolean;
  /** 화면에 따라 범례를 왼쪽 또는 가운데로 모은다. */
  legendAlign?: 'start' | 'center';
  trackHeight?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 장기기억 / 단기기억 / 남음 세 칸 진행 바. 남음은 서버가 내려주지 않고 총합에서 뺀다 —
 * 곡 상세의 단계 진행 바(`SongDetailTierJourney`)와 같은 범례·같은 판정을 쓴다.
 */
function MemoryProgressBar({
  totalCount,
  longTermCount,
  shortTermCount,
  showLegend = false,
  legendAlign = 'start',
  trackHeight = 8,
  style,
}: MemoryProgressBarProps) {
  const { longTerm, shortTerm, remaining, total } = useMemo(() => {
    const safeTotal = atLeastZero(totalCount);
    const safeLongTerm = Math.min(atLeastZero(longTermCount), safeTotal);
    const safeShortTerm = Math.min(atLeastZero(shortTermCount), safeTotal - safeLongTerm);
    return {
      total: safeTotal,
      longTerm: safeLongTerm,
      shortTerm: safeShortTerm,
      remaining: safeTotal - safeLongTerm - safeShortTerm,
    };
  }, [totalCount, longTermCount, shortTermCount]);

  const longTermRatio = total > 0 ? longTerm / total : 0;
  const shortTermRatio = total > 0 ? shortTerm / total : 0;
  const remainingRatio = total > 0 ? remaining / total : 1;

  return (
    <View style={style}>
      <View style={[styles.track, { height: trackHeight, borderRadius: trackHeight }]}>
        {longTermRatio > 0 && <View style={[styles.longTermSegment, { flex: longTermRatio }]} />}
        {shortTermRatio > 0 && <View style={[styles.shortTermSegment, { flex: shortTermRatio }]} />}
        {remainingRatio > 0 && <View style={{ flex: remainingRatio }} />}
      </View>
      {showLegend && (
        <View style={[styles.legend, legendAlign === 'center' && styles.legendCenter]}>
          <LegendItem color={Colors.memoryLongTerm} label="장기기억" value={longTerm} />
          <LegendItem color={Colors.memoryShortTerm} label="단기기억" value={shortTerm} />
          <LegendItem color={Colors.memoryRemaining} label="남음" value={remaining} muted />
        </View>
      )}
    </View>
  );
}

/** 서버가 아직 새 필드를 안 주는 배포 틈(OTA 선반영)에서도 바가 깨지지 않게 0 으로 떨어뜨린다. */
function atLeastZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

const LegendItem = React.memo(function LegendItem({
  color,
  label,
  value,
  muted = false,
}: {
  color: string;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={[styles.legendValue, muted && styles.legendValueMuted]}>{value}</Text>
    </View>
  );
});

export default React.memo(MemoryProgressBar);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: Colors.tierTrack,
    gap: SEGMENT_GAP,
  },
  longTermSegment: {
    backgroundColor: Colors.memoryLongTerm,
  },
  shortTermSegment: {
    backgroundColor: Colors.memoryShortTerm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 12,
  },
  legendCenter: {
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: LEGEND_DOT_SIZE,
    height: LEGEND_DOT_SIZE,
    borderRadius: 9999,
  },
  legendLabel: {
    ...Typography.body,
    color: Colors.textMuted,
    fontSize: 11.5,
  },
  legendValue: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 11.5,
  },
  legendValueMuted: {
    color: Colors.textMuted,
  },
});
