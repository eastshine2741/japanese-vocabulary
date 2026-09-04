import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../../theme/theme';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailMajorWords } from './SongDetailMajorWords';
import { SongDetailWordItem } from './types';

export interface SongDetailLearningProgress {
  total: number;
  mastered: number;
  studying: number;
  newWords: number;
}

interface SongDetailHomeTabProps {
  words: readonly SongDetailWordItem[];
  progress: SongDetailLearningProgress;
  isLoadingWords?: boolean;
  onViewAllWordsPress?: () => void;
  onStartWordLearning: (word: SongDetailWordItem) => void;
  busyWordKey?: string | null;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  words,
  progress,
  isLoadingWords = false,
  onViewAllWordsPress,
  busyWordKey,
  onStartWordLearning,
  style,
}: SongDetailHomeTabProps) {
  return (
    <View style={[styles.container, style]}>
      <SongDetailProgressSummary progress={progress} />
      <SongDetailMajorWords
        words={words}
        isLoading={isLoadingWords}
        onViewAllWordsPress={onViewAllWordsPress}
        busyWordKey={busyWordKey}
        onStartWordLearning={onStartWordLearning}
      />
      <SongDetailJlptChart words={words} isLoading={isLoadingWords} />
    </View>
  );
});

const SongDetailProgressSummary = React.memo(function SongDetailProgressSummary({
  progress,
}: {
  progress: SongDetailLearningProgress;
}) {
  const safeTotal = Math.max(progress.total, 0);
  const mastered = Math.max(progress.mastered, 0);
  const studying = Math.max(progress.studying, 0);
  const newWords = Math.max(progress.newWords, 0);
  const learnedCount = Math.min(safeTotal, mastered + studying);
  const masteredRatio = safeTotal > 0 ? Math.min(1, mastered / safeTotal) : 0;
  const studyingRatio = safeTotal > 0 ? Math.min(1 - masteredRatio, studying / safeTotal) : 0;
  const emptyRatio = safeTotal > 0 ? Math.max(0, 1 - masteredRatio - studyingRatio) : 1;

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.title}>나의 진도</Text>
        <Text style={styles.progressCount}>{safeTotal}개 중 {learnedCount}개</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressSegment, styles.progressMastered, { flex: masteredRatio }]} />
        <View style={[styles.progressSegment, styles.progressStudying, { flex: studyingRatio }]} />
        <View style={[styles.progressSegment, styles.progressEmpty, { flex: emptyRatio }]} />
      </View>

      <View style={styles.progressLegend}>
        <ProgressLegendItem color={Colors.primary} label={`아는 단어 ${mastered}`} />
        <ProgressLegendItem color={Colors.accentSecondary} label={`익히는 중 ${studying}`} />
        <ProgressLegendItem color={Colors.border} label={`아직 ${newWords}`} />
      </View>
    </View>
  );
});

const ProgressLegendItem = React.memo(function ProgressLegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  progressSection: {
    gap: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  progressCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 9999,
    backgroundColor: Colors.elevated,
  },
  progressSegment: {
    minWidth: 0,
  },
  progressMastered: {
    backgroundColor: Colors.primary,
  },
  progressStudying: {
    backgroundColor: Colors.accentSecondary,
  },
  progressEmpty: {
    backgroundColor: Colors.elevated,
  },
  progressLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
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
  legendLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
