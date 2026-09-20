import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongWordTierDto, SongWordTierKey } from '../../types/song';
import { PrimaryButton } from '../PrimaryButton';
import WordMasteryProgressBar from '../WordMasteryProgressBar';
import { resolveTierStatuses, selectCurrentTier, SongWordTierStatus } from './songDetailWordDerivation';

interface SongDetailTierRoadmapProps {
  tiers: readonly SongWordTierDto[];
  isStartingLearning?: boolean;
  onStartTier: (tier: SongWordTierDto) => void;
}

export const SongDetailTierRoadmap = React.memo(function SongDetailTierRoadmap({
  tiers,
  isStartingLearning = false,
  onStartTier,
}: SongDetailTierRoadmapProps) {
  const statuses = useMemo(() => resolveTierStatuses(tiers), [tiers]);
  const currentKey = useMemo(() => selectCurrentTier(tiers)?.key ?? null, [tiers]);
  const [expandedKey, setExpandedKey] = useState<SongWordTierKey | null>(currentKey);

  useEffect(() => {
    setExpandedKey(currentKey);
  }, [currentKey]);

  const handleToggle = useCallback((key: SongWordTierKey) => {
    setExpandedKey(prev => (prev === key ? null : key));
  }, []);

  if (tiers.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>학습 로드맵</Text>
      </View>
      <View style={styles.roadmap}>
        {tiers.map((tier, index) => (
          <TierRow
            key={tier.key}
            tier={tier}
            status={statuses[index]}
            isExpanded={expandedKey === tier.key}
            isLast={index === tiers.length - 1}
            isStartingLearning={isStartingLearning}
            onToggle={handleToggle}
            onStartTier={onStartTier}
          />
        ))}
      </View>
    </View>
  );
});

interface TierRowProps {
  tier: SongWordTierDto;
  status: SongWordTierStatus;
  isExpanded: boolean;
  isLast: boolean;
  isStartingLearning: boolean;
  onToggle: (key: SongWordTierKey) => void;
  onStartTier: (tier: SongWordTierDto) => void;
}

const TierRow = React.memo(function TierRow({
  tier,
  status,
  isExpanded,
  isLast,
  isStartingLearning,
  onToggle,
  onStartTier,
}: TierRowProps) {
  const handleToggle = useCallback(() => {
    onToggle(tier.key);
  }, [onToggle, tier.key]);
  const handleStart = useCallback(() => {
    onStartTier(tier);
  }, [onStartTier, tier]);

  const isCurrent = status === 'current';
  const isDone = status === 'done';
  const nameColor = isCurrent ? Colors.textPrimary : Colors.textSecondary;
  const metaColor = isCurrent ? Colors.textSecondary : Colors.textMuted;

  return (
    <View style={styles.tierRow}>
      <View style={styles.rail}>
        <View style={[styles.badge, isCurrent && styles.badgeCurrent]}>
          {isDone ? (
            <Feather name="check" size={18} color={Colors.textMuted} />
          ) : (
            <Text style={[styles.badgeNumber, isCurrent && styles.badgeNumberCurrent]}>{tier.order}</Text>
          )}
        </View>
        {!isLast && <View style={styles.railLine} />}
      </View>

      <View style={[styles.body, isLast && styles.bodyLast]}>
        <Pressable
          style={styles.tierHeader}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={`${tier.name} 단계, ${tier.knownCount}/${tier.totalCount}`}
        >
          <View style={styles.titleGroup}>
            <Text style={[styles.tierName, { color: nameColor }]}>{tier.name}</Text>
            <Text style={[styles.tierDesc, { color: metaColor }]} numberOfLines={1}>
              {tier.description}
            </Text>
          </View>
          <Text style={[styles.tierCount, { color: metaColor }]}>
            {tier.knownCount}/{tier.totalCount}
          </Text>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={metaColor} />
        </Pressable>

        {isExpanded && (
          <>
            <WordMasteryProgressBar
              totalCount={tier.totalCount}
              masteredCount={tier.knownCount}
              studyingCount={tier.learningCount}
            />
            {!isDone && (
              <PrimaryButton
                label={`${tier.name} 학습하기`}
                onPress={handleStart}
                disabled={isStartingLearning || tier.totalCount === 0}
                style={styles.learnButton}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 10,
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
  roadmap: {
    paddingTop: 4,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    width: 32,
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.wordMasteryTrackBackground,
  },
  badgeCurrent: {
    backgroundColor: Colors.primary,
  },
  badgeNumber: {
    ...Typography.headingBold,
    color: Colors.textMuted,
    fontSize: 15,
  },
  badgeNumberCurrent: {
    color: '#FFFFFF',
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
  },
  body: {
    flex: 1,
    gap: 12,
    paddingTop: 4,
    paddingBottom: 26,
  },
  bodyLast: {
    paddingBottom: 4,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 24,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    ...Typography.headingBold,
    fontSize: 15,
  },
  tierDesc: {
    ...Typography.body,
    flexShrink: 1,
    fontSize: 12,
  },
  tierCount: {
    ...Typography.bodySemiBold,
    fontSize: 12,
  },
  learnButton: {
    height: 40,
    borderRadius: 20,
  },
});
