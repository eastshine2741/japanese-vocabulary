import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../../theme/theme';
import type { SongWordTierDto } from '../../types/song';
import WordMasteryProgressBar from '../WordMasteryProgressBar';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailMajorWords } from './SongDetailMajorWords';
import { SongDetailTierRoadmap } from './SongDetailTierRoadmap';
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
  tiers: readonly SongWordTierDto[] | null;
  isLoadingWords?: boolean;
  isStartingLearning?: boolean;
  onViewAllWordsPress?: () => void;
  onStartTier: (tier: SongWordTierDto) => void;
  onStartWordLearning: (word: SongDetailWordItem) => void;
  busyWordKey?: string | null;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  words,
  progress,
  tiers,
  isLoadingWords = false,
  isStartingLearning = false,
  onViewAllWordsPress,
  busyWordKey,
  onStartTier,
  onStartWordLearning,
  style,
}: SongDetailHomeTabProps) {
  return (
    <View style={[styles.container, style]}>
      <SongDetailProgressSummary progress={progress} />
      {tiers != null && (
        <SongDetailTierRoadmap
          tiers={tiers}
          isStartingLearning={isStartingLearning}
          onStartTier={onStartTier}
        />
      )}
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
  const knownCount = Math.min(safeTotal, mastered);

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.title}>나의 진도</Text>
        <Text style={styles.progressCount}>{knownCount}/{safeTotal}</Text>
      </View>

      <WordMasteryProgressBar
        totalCount={safeTotal}
        masteredCount={mastered}
        studyingCount={studying}
        showLegend
        masteredLabel="아는 단어"
        studyingLabel="익히는 중"
        newLabel="아직"
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
