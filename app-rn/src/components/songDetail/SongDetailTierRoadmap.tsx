import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<SongWordTierKey>>(
    () => new Set(currentKey != null ? [currentKey] : []),
  );

  // 현재 단계가 바뀌면(이전 단계를 끝냈을 때) 새 현재 단계를 펼쳐 둔다. 이미 펼친 다른 단계는 그대로.
  useEffect(() => {
    if (currentKey == null) return;
    setExpandedKeys(prev => (prev.has(currentKey) ? prev : new Set(prev).add(currentKey)));
  }, [currentKey]);

  const handleToggle = useCallback((key: SongWordTierKey) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
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
            isExpanded={expandedKeys.has(tier.key)}
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

  const progress = useSharedValue(isExpanded ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, EXPAND_TIMING);
  }, [isExpanded, progress]);

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    contentHeight.value = e.nativeEvent.layout.height;
  }, [contentHeight]);

  const detailsStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

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
          <Animated.View style={chevronStyle}>
            <Feather name="chevron-down" size={20} color={metaColor} />
          </Animated.View>
        </Pressable>

        <Animated.View style={[styles.details, detailsStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
          <View style={styles.detailsContent} onLayout={handleContentLayout}>
            <WordMasteryProgressBar
              totalCount={tier.totalCount}
              masteredCount={tier.knownCount}
              studyingCount={tier.learningCount}
            />
            <PrimaryButton
              label={`${tier.name} 학습하기`}
              onPress={handleStart}
              disabled={isStartingLearning || tier.totalCount === 0}
              style={styles.learnButton}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
});

const EXPAND_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

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
  details: {
    overflow: 'hidden',
  },
  // 절대 배치로 컨테이너 높이와 무관하게 본래 높이를 측정한다. 접힌 상태의 gap 이 남지 않도록 여백은 안쪽에 둔다.
  detailsContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    gap: 12,
    paddingTop: 12,
  },
  learnButton: {
    height: 40,
    borderRadius: 20,
  },
});
