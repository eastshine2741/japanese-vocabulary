import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { MemoryForecastDay } from '../../types/studySchedule';

const CHART_HEIGHT = 150;
const STROKE = 2;
/** 분기 눈금. 인덱스 -> 라벨. 365일 예보를 전제한다. */
const QUARTER_TICKS: [number, string][] = [[0, '오늘'], [91, '3개월'], [182, '6개월'], [273, '9개월'], [364, '1년']];

interface Props {
  days: MemoryForecastDay[];
  totalCards: number;
}

/** 1년 동안 기억하고 있을 단어 수 — 매일 복습할 때와 오늘부터 쉴 때. 점선은 보유 카드 수. */
export const ForecastChart = React.memo(function ForecastChart({ days, totalCards }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const paths = useMemo(() => {
    if (width === 0 || days.length < 2) return null;
    const max = Math.max(1, totalCards);
    const plotTop = STROKE;
    const plotHeight = CHART_HEIGHT - STROKE * 2;
    const x = (i: number) => (i / (days.length - 1)) * width;
    const y = (v: number) => plotTop + plotHeight - (Math.min(v, max) / max) * plotHeight;
    const line = (pick: (d: MemoryForecastDay) => number) =>
      days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join('');
    const area = (l: string) => `${l}L${width},${CHART_HEIGHT}L0,${CHART_HEIGHT}Z`;
    const reviewed = line(d => d.rememberedIfReviewed);
    const skipped = line(d => d.rememberedIfSkipped);
    return {
      reviewed,
      skipped,
      reviewedArea: area(reviewed),
      skippedArea: area(skipped),
      totalY: y(max),
    };
  }, [days, totalCards, width]);

  const last = days[days.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.chartBox} onLayout={onLayout}>
        {paths && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line
              x1={0}
              x2={width}
              y1={paths.totalY}
              y2={paths.totalY}
              stroke={Colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <Path d={paths.reviewedArea} fill={Colors.forecastReviewed} fillOpacity={0.1} />
            <Path d={paths.skippedArea} fill={Colors.forecastSkipped} fillOpacity={0.12} />
            <Path d={paths.reviewed} fill="none" stroke={Colors.forecastReviewed} strokeWidth={STROKE} strokeLinejoin="round" />
            <Path d={paths.skipped} fill="none" stroke={Colors.forecastSkipped} strokeWidth={STROKE} strokeLinejoin="round" />
          </Svg>
        )}
        <Text style={styles.totalLabel}>보유 {totalCards}개</Text>
      </View>

      <View style={styles.tickRow}>
        {QUARTER_TICKS.map(([index, label]) => (
          <Text key={index} style={[styles.tick, index === 0 && styles.tickToday]}>{label}</Text>
        ))}
      </View>

      {last && (
        <View style={styles.legend}>
          <LegendItem color={Colors.forecastReviewed} label="매일 복습하면" value={last.rememberedIfReviewed} />
          <LegendItem color={Colors.forecastSkipped} label="오늘부터 쉬면" value={last.rememberedIfSkipped} />
        </View>
      )}
    </View>
  );
});

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}개</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  chartBox: {
    height: CHART_HEIGHT,
  },
  totalLabel: {
    ...Typography.bodySemiBold,
    position: 'absolute',
    top: 4,
    left: 0,
    fontSize: 10,
    color: Colors.textMuted,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tick: {
    ...Typography.bodyBold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  tickToday: {
    color: Colors.primary,
  },
  legend: {
    gap: 6,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendLabel: {
    ...Typography.bodyMedium,
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  legendValue: {
    ...Typography.bodyBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
