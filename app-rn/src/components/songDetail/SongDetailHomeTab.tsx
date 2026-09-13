import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../../theme/theme';
import WordMasteryProgressBar from '../WordMasteryProgressBar';
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
  const learnedCount = Math.min(safeTotal, mastered + studying);

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.title}>나의 진도</Text>
        <Text style={styles.progressCount}>{safeTotal}개 중 {learnedCount}개</Text>
      </View>

      <WordMasteryProgressBar
        totalCount={safeTotal}
        masteredCount={mastered}
        studyingCount={studying}
        showLegend
      />
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
});
