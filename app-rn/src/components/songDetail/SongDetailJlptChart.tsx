import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../theme/theme';
import { buildJlptDistribution } from './songDetailWordDerivation';
import { SongDetailJlptSlice, SongDetailWordItem } from './types';

const CHART_SIZE = 120;
const STROKE_WIDTH = 21;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface DonutSegmentProps {
  slice: SongDetailJlptSlice;
  offset: number;
  total: number;
}

interface SongDetailJlptChartProps {
  words: readonly SongDetailWordItem[];
  isLoading?: boolean;
}

const DonutSegment = React.memo(function DonutSegment({ slice, offset, total }: DonutSegmentProps) {
  if (slice.count === 0 || total === 0) return null;

  const ratio = slice.count / total;
  const dashLength = CIRCUMFERENCE * ratio;
  const dashOffset = CIRCUMFERENCE * (1 - offset / total);

  return (
    <Circle
      cx={CHART_SIZE / 2}
      cy={CHART_SIZE / 2}
      r={RADIUS}
      fill="none"
      stroke={slice.color}
      strokeWidth={STROKE_WIDTH}
      strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
      strokeDashoffset={dashOffset}
      rotation="-90"
      originX={CHART_SIZE / 2}
      originY={CHART_SIZE / 2}
    />
  );
});

const LegendItem = React.memo(function LegendItem({ slice }: { slice: SongDetailJlptSlice }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
      <Text style={styles.legendText}>
        {slice.label} · {slice.percent}%
      </Text>
    </View>
  );
});

export const SongDetailJlptChart = React.memo(function SongDetailJlptChart({
  words,
  isLoading = false,
}: SongDetailJlptChartProps) {
  const slices = useMemo(() => buildJlptDistribution(words), [words]);
  const total = words.length;

  let runningCount = 0;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>난이도</Text>

      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.stateText}>난이도 분포를 계산하는 중이에요.</Text>
        </View>
      ) : total === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyDonut} />
          <Text style={styles.stateText}>아직 분석할 단어가 없어요.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.chartWrapper}>
            <Svg width={CHART_SIZE} height={CHART_SIZE}>
              <Circle
                cx={CHART_SIZE / 2}
                cy={CHART_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={Colors.border}
                strokeWidth={STROKE_WIDTH}
              />
              {slices.map(slice => {
                const offset = runningCount;
                runningCount += slice.count;
                return (
                  <DonutSegment
                    key={slice.key}
                    slice={slice}
                    offset={offset}
                    total={total}
                  />
                );
              })}
            </Svg>
          </View>

          <View style={styles.legend}>
            {slices.map(slice => (
              <LegendItem key={slice.key} slice={slice} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 35,
  },
  chartWrapper: {
    width: CHART_SIZE,
    height: CHART_SIZE,
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
  },
  legendText: {
    color: Colors.textPrimary,
    fontSize: 11,
  },
  stateBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  emptyDonut: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    borderRadius: CHART_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderColor: Colors.border,
  },
});
