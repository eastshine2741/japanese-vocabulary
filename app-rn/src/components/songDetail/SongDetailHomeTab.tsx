import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { SongCoverageDto, SongWordTierDto } from '../../types/song';
import type { SongContributorsDto } from '../../types/songReport';
import { SongDetailContributors } from './SongDetailContributors';
import { SongDetailCoverageSection } from './SongDetailCoverageSection';
import type { PreviewSong } from '../rewardCards/cardPreview';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailTierJourney } from './SongDetailTierJourney';
import { SongDetailWordItem } from './types';

interface SongDetailHomeTabProps {
  song: PreviewSong;
  words: readonly SongDetailWordItem[];
  /** 서버가 이해도를 못 주면 null 이고 그 섹션은 그리지 않는다. */
  coverage: SongCoverageDto | null;
  /** 서버가 단계를 못 주면 null 이고 그 섹션은 그리지 않는다. */
  tiers: readonly SongWordTierDto[] | null;
  /** 승인된 제보를 낸 사람들. null 이면 그 섹션은 그리지 않는다. */
  contributors: SongContributorsDto | null;
  isLoadingWords?: boolean;
  onCoverageHelpPress: () => void;
  onStartTier: (tier: SongWordTierDto) => void;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  song,
  words,
  coverage,
  tiers,
  contributors,
  isLoadingWords = false,
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
          key={song.id}
          song={song}
          tiers={tiers}
          onStartTier={onStartTier}
        />
      )}
      <SongDetailJlptChart words={words} isLoading={isLoadingWords} />
      {contributors != null && <SongDetailContributors contributors={contributors} />}
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
