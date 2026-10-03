import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { SongCoverageDto, SongWordTierDto } from '../../types/song';
import { SongDetailCoverageSection } from './SongDetailCoverageSection';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailTierJourney } from './SongDetailTierJourney';
import { SongDetailWordItem } from './types';

interface SongDetailHomeTabProps {
  songId: number;
  words: readonly SongDetailWordItem[];
  /** 서버가 이해도를 못 주면 null 이고 그 섹션은 그리지 않는다. */
  coverage: SongCoverageDto | null;
  /** 서버가 단계를 못 주면 null 이고 그 섹션은 그리지 않는다. */
  tiers: readonly SongWordTierDto[] | null;
  isLoadingWords?: boolean;
  isStartingLearning?: boolean;
  onCoverageHelpPress: () => void;
  onStartTier: (tier: SongWordTierDto) => void;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  songId,
  words,
  coverage,
  tiers,
  isLoadingWords = false,
  isStartingLearning = false,
  onCoverageHelpPress,
  onStartTier,
  style,
}: SongDetailHomeTabProps) {
  return (
    <View style={[styles.container, style]}>
      {coverage != null && (
        <SongDetailCoverageSection coverage={coverage} onHelpPress={onCoverageHelpPress} />
      )}
      {tiers != null && (
        <SongDetailTierJourney
          key={songId}
          tiers={tiers}
          isStartingLearning={isStartingLearning}
          onStartTier={onStartTier}
        />
      )}
      <SongDetailJlptChart words={words} isLoading={isLoadingWords} />
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
});
