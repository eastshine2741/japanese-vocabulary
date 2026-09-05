import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { buildJlptDistribution } from './songDetailWordDerivation';
import { SongDetailJlptSlice, SongDetailWordItem } from './types';

interface SongDetailJlptChartProps {
  words: readonly SongDetailWordItem[];
  isLoading?: boolean;
}

const LevelBarSegment = React.memo(function LevelBarSegment({ slice }: { slice: SongDetailJlptSlice }) {
  if (slice.count === 0) return null;

  return (
    <View
      style={[
        styles.levelBarSegment,
        {
          flexGrow: slice.count,
          backgroundColor: slice.color,
        },
      ]}
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
  const summary = useMemo(() => {
    if (total === 0) return null;
    const dominant = slices.reduce((current, slice) => {
      if (slice.count > current.count) return slice;
      return current;
    }, slices[0]);
    return `${dominant.label} 중심`;
  }, [slices, total]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>난이도</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      </View>

      {isLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.stateText}>난이도 분포를 계산하는 중이에요.</Text>
        </View>
      ) : total === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyBar} />
          <Text style={styles.stateText}>아직 분석할 단어가 없어요.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.levelBar}>
            {slices.map(slice => (
              <LevelBarSegment key={slice.key} slice={slice} />
            ))}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              {slices.slice(0, 3).map(slice => (
                <LegendItem key={slice.key} slice={slice} />
              ))}
            </View>
            <View style={styles.legendRow}>
              {slices.slice(3).map(slice => (
                <LegendItem key={slice.key} slice={slice} />
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  summary: {
    ...Typography.bodySemiBold,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    gap: 10,
  },
  levelBar: {
    height: 10,
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
    borderRadius: 9999,
    backgroundColor: '#F6F6F6',
  },
  levelBarSegment: {
    height: 10,
    flexBasis: 0,
  },
  legend: {
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
  },
  legendItem: {
    width: 110,
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
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  stateBox: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  emptyBar: {
    width: '100%',
    height: 10,
    borderRadius: 9999,
    backgroundColor: '#F6F6F6',
  },
});
