import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { MemoryForecastDay } from '../../types/studySchedule';
import { yAxisTicks } from './scheduleMath';

const CHART_HEIGHT = 150;
const STROKE = 2;
/** y축 라벨 칸 너비. x축 눈금 줄도 이만큼 들여 그래프와 맞춘다. */
const AXIS_WIDTH = 32;
const AXIS_LABEL_HEIGHT = 12;
/** 분기 눈금. 인덱스 -> 라벨. 365일 예보를 전제한다. */
const QUARTER_TICKS: [number, string][] = [[0, '오늘'], [91, '3개월'], [182, '6개월'], [273, '9개월'], [364, '1년']];

interface Props {
  days: MemoryForecastDay[];
  studiedCards: number;
}

/** 1년 동안 기억하고 있을 단어 수 — 매일 복습할 때와 오늘부터 쉴 때. 점선은 한 번 이상 외운 단어 수. */
export const ForecastChart = React.memo(function ForecastChart({ days, studiedCards }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const max = Math.max(1, studiedCards);
  const y = useCallback(
    (v: number) => STROKE + (CHART_HEIGHT - STROKE * 2) * (1 - Math.min(v, max) / max),
    [max],
  );
  const ticks = useMemo(() => yAxisTicks(max), [max]);

  const paths = useMemo(() => {
    if (width === 0 || days.length < 2) return null;
    const x = (i: number) => (i / (days.length - 1)) * width;
    const line = (pick: (d: MemoryForecastDay) => number) =>
      days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join('');
    return {
      reviewed: line(d => d.rememberedIfReviewed),
      skipped: line(d => d.rememberedIfSkipped),
      totalY: y(max),
    };
  }, [days, max, width, y]);

  const first = days[0];
  const last = days[days.length - 1];

  return (
    <View style={styles.wrap}>
      <Text style={styles.totalLabel}>외운 단어 {studiedCards}개</Text>
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          {ticks.map(v => (
            <Text key={v} style={[styles.yLabel, { top: y(v) - AXIS_LABEL_HEIGHT / 2 }]}>{v}</Text>
          ))}
        </View>
        <View style={styles.chartBox} onLayout={onLayout}>
          {paths && (
            <Svg width={width} height={CHART_HEIGHT}>
              {ticks.map(v => (
                <Line key={v} x1={0} x2={width} y1={y(v)} y2={y(v)} stroke={Colors.border} strokeWidth={1} />
              ))}
              <Line
                x1={0}
                x2={width}
                y1={paths.totalY}
                y2={paths.totalY}
                stroke={Colors.textTertiary}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Path d={paths.reviewed} fill="none" stroke={Colors.forecastReviewed} strokeWidth={STROKE} strokeLinejoin="round" />
              <Path d={paths.skipped} fill="none" stroke={Colors.forecastSkipped} strokeWidth={STROKE} strokeLinejoin="round" />
            </Svg>
          )}
        </View>
      </View>

      <View style={styles.tickRow}>
        {QUARTER_TICKS.map(([index, label]) => (
          <Text key={index} style={[styles.tick, index === 0 && styles.tickToday]}>{label}</Text>
        ))}
      </View>

      {first && last && (
        <View style={styles.legend}>
          <LegendItem
            color={Colors.forecastReviewed}
            label="매일 복습하면"
            value={`${last.rememberedIfReviewed}개 기억`}
          />
          <LegendItem
            color={Colors.forecastSkipped}
            label="오늘부터 쉬면"
            value={`${last.rememberedIfSkipped}개 기억 · ${Math.max(0, first.rememberedIfSkipped - last.rememberedIfSkipped)}개를 잊어요`}
          />
        </View>
      )}
    </View>
  );
});

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: AXIS_WIDTH,
    height: CHART_HEIGHT,
  },
  yLabel: {
    ...Typography.bodySemiBold,
    position: 'absolute',
    right: 6,
    height: AXIS_LABEL_HEIGHT,
    lineHeight: AXIS_LABEL_HEIGHT,
    fontSize: 10,
    color: Colors.textMuted,
  },
  chartBox: {
    flex: 1,
    height: CHART_HEIGHT,
  },
  totalLabel: {
    ...Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  tickRow: {
    paddingLeft: AXIS_WIDTH,
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
    flexGrow: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  legendValue: {
    ...Typography.bodyBold,
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
