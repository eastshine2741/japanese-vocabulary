import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../theme/theme';

const SEGMENT_GAP = 2;
const LEGEND_DOT_SIZE = 7;

export type WordMasteryProgressBarLegendAlignment = 'start' | 'space-between';

export interface WordMasteryProgressBarProps {
  totalCount: number;
  masteredCount: number;
  studyingCount: number;
  showLegend?: boolean;
  legendAlignment?: WordMasteryProgressBarLegendAlignment;
  masteredLabel?: string;
  studyingLabel?: string;
  newLabel?: string;
  trackHeight?: number;
  style?: StyleProp<ViewStyle>;
}

function WordMasteryProgressBar({
  totalCount,
  masteredCount,
  studyingCount,
  showLegend = false,
  legendAlignment = 'start',
  masteredLabel = '아는 단어',
  studyingLabel = '학습 중',
  newLabel = '아직',
  trackHeight = 8,
  style,
}: WordMasteryProgressBarProps) {
  const { masteredRatio, studyingRatio, newRatio, safeMastered, safeStudying, safeNew } = useMemo(() => {
    const safeTotal = Math.max(0, totalCount);
    const mastered = Math.min(Math.max(0, masteredCount), safeTotal);
    const studying = Math.min(Math.max(0, studyingCount), Math.max(0, safeTotal - mastered));
    const newCount = Math.max(0, safeTotal - mastered - studying);
    return {
      safeMastered: mastered,
      safeStudying: studying,
      safeNew: newCount,
      masteredRatio: safeTotal > 0 ? mastered / safeTotal : 0,
      studyingRatio: safeTotal > 0 ? studying / safeTotal : 0,
      newRatio: safeTotal > 0 ? newCount / safeTotal : 1,
    };
  }, [totalCount, masteredCount, studyingCount]);

  return (
    <View style={style}>
      <View style={[styles.track, { height: trackHeight, borderRadius: trackHeight }]}>
        {masteredRatio > 0 && <View style={[styles.segment, styles.masteredSegment, { flex: masteredRatio }]} />}
        {studyingRatio > 0 && <View style={[styles.segment, styles.studyingSegment, { flex: studyingRatio }]} />}
        {newRatio > 0 && <View style={[styles.segment, { flex: newRatio }]} />}
      </View>
      {showLegend && (
        <View
          style={[
            styles.legend,
            legendAlignment === 'space-between' ? styles.legendSpaceBetween : styles.legendStart,
          ]}
        >
          <LegendDot color={Colors.primary} label={`${masteredLabel} ${safeMastered}`} />
          <LegendDot color={Colors.wordMasteryStudying} label={`${studyingLabel} ${safeStudying}`} />
          <LegendDot color={Colors.wordMasteryNewIndicator} label={`${newLabel} ${safeNew}`} />
        </View>
      )}
    </View>
  );
}

const LegendDot = React.memo(function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
});

export default React.memo(WordMasteryProgressBar);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: Colors.wordMasteryTrackBackground,
    gap: SEGMENT_GAP,
  },
  segment: {
    minWidth: 0,
  },
  masteredSegment: {
    backgroundColor: Colors.primary,
  },
  studyingSegment: {
    backgroundColor: Colors.wordMasteryStudying,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 14,
  },
  legendStart: {
    justifyContent: 'flex-start',
  },
  legendSpaceBetween: {
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: LEGEND_DOT_SIZE,
    height: LEGEND_DOT_SIZE,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
