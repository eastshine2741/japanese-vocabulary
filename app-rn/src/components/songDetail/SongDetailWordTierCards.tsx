import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongWordTierDto } from '../../types/song';

const CORE_CHIP_LIMIT = 5;

interface SongDetailWordTierCardsProps {
  tiers: readonly SongWordTierDto[];
  isStartingLearning?: boolean;
  onStartTier: (tier: SongWordTierDto) => void;
  onViewAllWordsPress?: () => void;
}

export const SongDetailWordTierCards = React.memo(function SongDetailWordTierCards({
  tiers,
  isStartingLearning = false,
  onStartTier,
  onViewAllWordsPress,
}: SongDetailWordTierCardsProps) {
  const totalWords = useMemo(() => tiers.reduce((sum, tier) => sum + tier.totalCount, 0), [tiers]);
  const coreTier = tiers.find(tier => tier.key === 'CORE');
  const starterTier = tiers.find(tier => tier.key === 'STARTER');
  const basicTier = tiers.find(tier => tier.key === 'BASIC');
  const advancedTier = tiers.find(tier => tier.key === 'ADVANCED');

  const handleViewAll = useCallback(() => {
    onViewAllWordsPress?.();
  }, [onViewAllWordsPress]);

  if (tiers.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>단어 학습</Text>
        <Text style={styles.headerCount}>{totalWords}단어</Text>
      </View>

      <View style={styles.grid}>
        {coreTier && (
          <CoreTierCard tier={coreTier} disabled={isStartingLearning} onStartTier={onStartTier} />
        )}
        {(starterTier || basicTier) && (
          <View style={styles.row}>
            {starterTier && (
              <CompactTierCard
                tier={starterTier}
                iconName="sprout"
                disabled={isStartingLearning}
                onStartTier={onStartTier}
              />
            )}
            {basicTier && (
              <CompactTierCard
                tier={basicTier}
                iconName="leaf"
                disabled={isStartingLearning}
                onStartTier={onStartTier}
              />
            )}
          </View>
        )}
        {advancedTier && (
          <AdvancedTierCard tier={advancedTier} disabled={isStartingLearning} onStartTier={onStartTier} />
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.72}
          disabled={!onViewAllWordsPress}
          accessibilityRole="button"
          accessibilityLabel="모든 단어 보기"
        >
          <Feather name="list" size={15} color={Colors.textSecondary} />
          <Text style={styles.viewAllText}>모든 단어 보기</Text>
          <Feather name="chevron-right" size={13} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface TierProgressBarProps {
  totalCount: number;
  masteredCount: number;
  studyingCount: number;
  height: number;
  trackColor: string;
  knownColor: string;
  studyingColor: string;
}

const TierProgressBar = React.memo(function TierProgressBar({
  totalCount,
  masteredCount,
  studyingCount,
  height,
  trackColor,
  knownColor,
  studyingColor,
}: TierProgressBarProps) {
  const safeTotal = Math.max(0, totalCount);
  const known = Math.min(Math.max(0, masteredCount), safeTotal);
  const studying = Math.min(Math.max(0, studyingCount), Math.max(0, safeTotal - known));
  const knownRatio = safeTotal > 0 ? known / safeTotal : 0;
  const studyingRatio = safeTotal > 0 ? studying / safeTotal : 0;

  return (
    <View style={[styles.progressTrack, { height, borderRadius: height, backgroundColor: trackColor }]}>
      {knownRatio > 0 && <View style={[styles.progressSegment, { flex: knownRatio, backgroundColor: knownColor }]} />}
      {studyingRatio > 0 && (
        <View style={[styles.progressSegment, { flex: studyingRatio, backgroundColor: studyingColor }]} />
      )}
    </View>
  );
});

interface TierCardProps {
  tier: SongWordTierDto;
  disabled: boolean;
  onStartTier: (tier: SongWordTierDto) => void;
}

const CoreTierCard = React.memo(function CoreTierCard({ tier, disabled, onStartTier }: TierCardProps) {
  const handlePress = useCallback(() => {
    onStartTier(tier);
  }, [onStartTier, tier]);
  const isDisabled = disabled || tier.totalCount === 0;
  const shownWords = tier.wordJapanese.slice(0, CORE_CHIP_LIMIT);
  const remaining = tier.totalCount - shownWords.length;

  return (
    <View style={styles.coreCard}>
      <View style={styles.coreTitleGroup}>
        <Text style={styles.coreName}>{tier.name}</Text>
        <Text style={styles.coreDesc}>{tier.description}</Text>
      </View>

      <View style={styles.chipRow}>
        {shownWords.map(word => (
          <View key={word} style={styles.chip}>
            <Text style={styles.chipText}>{word}</Text>
          </View>
        ))}
        {remaining > 0 && <Text style={styles.chipMore}>+{remaining}</Text>}
      </View>

      <View style={styles.coreBottom}>
        <View style={styles.coreProgress}>
          <Text style={styles.coreProgressLabel}>{tier.knownCount} / {tier.totalCount}</Text>
          <TierProgressBar
            totalCount={tier.totalCount}
            masteredCount={tier.knownCount}
            studyingCount={tier.learningCount}
            height={6}
            trackColor={Colors.tierCoreTrackBg}
            knownColor={Colors.primary}
            studyingColor={Colors.wordMasteryStudying}
          />
        </View>
        <TouchableOpacity
          style={[styles.coreLearnButton, isDisabled && styles.disabled]}
          onPress={handlePress}
          disabled={isDisabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${tier.name} 학습하기`}
        >
          <Text style={styles.coreLearnLabel}>학습하기</Text>
          <Feather name="arrow-right" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface CompactTierCardProps extends TierCardProps {
  iconName: 'sprout' | 'leaf';
}

const CompactTierCard = React.memo(function CompactTierCard({
  tier,
  iconName,
  disabled,
  onStartTier,
}: CompactTierCardProps) {
  const handlePress = useCallback(() => {
    onStartTier(tier);
  }, [onStartTier, tier]);
  const isDisabled = disabled || tier.totalCount === 0;

  return (
    <View style={styles.compactCard}>
      <View style={styles.compactTop}>
        <Text style={styles.compactName}>{tier.name}</Text>
        <MaterialCommunityIcons name={iconName} size={18} color={Colors.primary} />
      </View>
      <Text style={styles.compactDesc} numberOfLines={2}>
        {tier.description}
      </Text>
      <View style={styles.compactProgress}>
        <TierProgressBar
          totalCount={tier.totalCount}
          masteredCount={tier.knownCount}
          studyingCount={tier.learningCount}
          height={5}
          trackColor={Colors.card}
          knownColor={Colors.primary}
          studyingColor={Colors.wordMasteryStudying}
        />
        <Text style={styles.compactProgressLabel}>{tier.knownCount} / {tier.totalCount}</Text>
      </View>
      <TouchableOpacity
        style={[styles.compactLearnButton, isDisabled && styles.disabled]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${tier.name} 학습하기`}
      >
        <Text style={styles.compactLearnLabel}>학습하기</Text>
      </TouchableOpacity>
    </View>
  );
});

const AdvancedTierCard = React.memo(function AdvancedTierCard({ tier, disabled, onStartTier }: TierCardProps) {
  const handlePress = useCallback(() => {
    onStartTier(tier);
  }, [onStartTier, tier]);
  const isDisabled = disabled || tier.totalCount === 0;

  return (
    <View style={styles.advancedCard}>
      <View style={styles.advancedLeft}>
        <View style={styles.advancedTitleGroup}>
          <View style={styles.advancedNameRow}>
            <MaterialCommunityIcons name="trophy" size={18} color={Colors.tierAdvancedAccent} />
            <Text style={styles.advancedName}>{tier.name}</Text>
          </View>
          <Text style={styles.advancedDesc}>{tier.description}</Text>
        </View>
        <View style={styles.advancedProgress}>
          <TierProgressBar
            totalCount={tier.totalCount}
            masteredCount={tier.knownCount}
            studyingCount={tier.learningCount}
            height={5}
            trackColor={Colors.tierAdvancedBorder}
            knownColor={Colors.tierAdvancedAccent}
            studyingColor={Colors.wordMasteryStudying}
          />
          <Text style={styles.advancedProgressLabel}>{tier.knownCount} / {tier.totalCount}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.advancedLearnButton, isDisabled && styles.disabled]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${tier.name} 도전하기`}
      >
        <Text style={styles.advancedLearnLabel}>도전하기</Text>
      </TouchableOpacity>
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
    fontSize: 17,
  },
  headerCount: {
    ...Typography.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  disabled: {
    opacity: 0.45,
  },

  progressTrack: {
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  progressSegment: {
    minWidth: 0,
  },

  coreCard: {
    gap: 18,
    padding: 20,
    paddingBottom: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.tierCoreBg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  coreTitleGroup: {
    gap: 4,
  },
  coreName: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 28,
  },
  coreDesc: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.tierCoreChipBorder,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  chipMore: {
    ...Typography.bodySemiBold,
    color: Colors.textMuted,
    fontSize: 12,
  },
  coreBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  coreProgress: {
    flex: 1,
    gap: 6,
  },
  coreProgressLabel: {
    ...Typography.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  coreLearnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primaryShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  coreLearnLabel: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 15,
  },

  compactCard: {
    flex: 1,
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactName: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 19,
  },
  compactDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  compactProgress: {
    gap: 5,
  },
  compactProgressLabel: {
    ...Typography.bodySemiBold,
    color: Colors.textMuted,
    fontSize: 11,
  },
  compactLearnButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: Colors.primaryBg,
  },
  compactLearnLabel: {
    ...Typography.bodyBold,
    color: Colors.tierLearnButtonText,
    fontSize: 13,
  },

  advancedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.tierAdvancedBorder,
    backgroundColor: Colors.tierAdvancedBg,
  },
  advancedLeft: {
    flex: 1,
    gap: 10,
  },
  advancedTitleGroup: {
    gap: 4,
  },
  advancedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advancedName: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 19,
  },
  advancedDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  advancedProgress: {
    gap: 5,
  },
  advancedProgressLabel: {
    ...Typography.bodySemiBold,
    color: Colors.tierAdvancedText,
    fontSize: 11,
  },
  advancedLearnButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: Colors.tierAdvancedButtonBg,
  },
  advancedLearnLabel: {
    ...Typography.bodyBold,
    color: Colors.tierAdvancedText,
    fontSize: 13,
  },

  viewAllButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F6F6F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAllText: {
    ...Typography.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
