import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongWordTierDto, SongWordTierKey } from '../../types/song';
import { SongDetailDueWordRoller } from './SongDetailDueWordRoller';
import {
  buildTierSegments,
  estimateStudyMinutes,
  getTierStatus,
  selectExpandedTierKey,
  type SongWordTierStatus,
} from './songDetailTier';

interface SongDetailTierJourneyProps {
  tiers: readonly SongWordTierDto[];
  isStartingLearning?: boolean;
  onStartTier: (tier: SongWordTierDto) => void;
}

const SWITCH_DURATION = 300;
const CONTENT_FADE_DURATION = 220;

// 펼친 단계가 바뀌면 카드 틀은 그대로 둔 채 크기·위치만 옮겨 간다. 두 카드가 동시에 줄고 늘어서
// 펼친 자리가 위아래로 미끄러지는 것처럼 보인다. 틀 안 내용만 새로 페이드인한다.
const relayout = LinearTransition.duration(SWITCH_DURATION).easing(Easing.inOut(Easing.cubic));
const contentFadeIn = FadeIn.duration(CONTENT_FADE_DURATION);

/**
 * 완곡까지 3단계. 항상 한 장만 펼쳐져 있다 — 유저가 고르기 전에는 현재 단계(한 번도 리뷰 안 한
 * 단어가 남은 첫 단계)가 펼쳐지고, 한 번 고르면 곡을 떠날 때까지 그 선택을 따른다.
 */
export const SongDetailTierJourney = React.memo(function SongDetailTierJourney({
  tiers,
  isStartingLearning = false,
  onStartTier,
}: SongDetailTierJourneyProps) {
  const [pickedKey, setPickedKey] = useState<SongWordTierKey | null>(null);
  const autoKey = useMemo(() => selectExpandedTierKey(tiers), [tiers]);
  const expandedKey = pickedKey ?? autoKey;

  const handleExpand = useCallback((key: SongWordTierKey) => {
    setPickedKey(key);
  }, []);

  if (tiers.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>완곡까지 {tiers.length}단계</Text>
      <LayoutAnimationConfig skipEntering>
        {tiers.map((tier, index) => (
          <TierStep
            key={tier.key}
            tier={tier}
            status={getTierStatus(tiers, index)}
            isExpanded={tier.key === expandedKey}
            isLast={index === tiers.length - 1}
            isStartingLearning={isStartingLearning}
            onExpand={handleExpand}
            onStartTier={onStartTier}
          />
        ))}
      </LayoutAnimationConfig>
    </View>
  );
});

interface TierStepProps {
  tier: SongWordTierDto;
  status: SongWordTierStatus;
  isExpanded: boolean;
  isLast: boolean;
  isStartingLearning: boolean;
  onExpand: (key: SongWordTierKey) => void;
  onStartTier: (tier: SongWordTierDto) => void;
}

const TierStep = React.memo(function TierStep({
  tier,
  status,
  isExpanded,
  isLast,
  isStartingLearning,
  onExpand,
  onStartTier,
}: TierStepProps) {
  const handleExpand = useCallback(() => {
    onExpand(tier.key);
  }, [tier.key, onExpand]);

  const handleStart = useCallback(() => {
    onStartTier(tier);
  }, [tier, onStartTier]);

  return (
    <Animated.View layout={relayout} style={styles.step}>
      <View style={styles.rail}>
        <TierDot status={status} />
        {!isLast && (
          <Animated.View
            layout={relayout}
            style={[styles.connector, status === 'done' && styles.connectorDone]}
          />
        )}
      </View>
      <View style={[styles.stepBody, !isLast && styles.stepBodyGap]}>
        {/* 그림자는 바깥, 잘라내기는 안쪽. iOS 는 overflow hidden 인 뷰의 그림자를 그리지 않는다. */}
        <Animated.View
          layout={relayout}
          style={[styles.cardShadow, isExpanded && styles.cardShadowExpanded]}
        >
          <Animated.View
            layout={relayout}
            style={[styles.cardFrame, isExpanded && styles.cardFrameExpanded]}
          >
            {isExpanded ? (
              <Animated.View key="expanded" entering={contentFadeIn}>
                <ExpandedTierCard
                  tier={tier}
                  isStartingLearning={isStartingLearning}
                  onStart={handleStart}
                />
              </Animated.View>
            ) : (
              <Animated.View key="collapsed" entering={contentFadeIn}>
                <CollapsedTierCard tier={tier} onExpand={handleExpand} />
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
});

const TierDot = React.memo(function TierDot({ status }: { status: SongWordTierStatus }) {
  if (status === 'done') {
    return (
      <View style={styles.dotDone}>
        <Feather name="check" size={12} color="#FFFFFF" />
      </View>
    );
  }
  if (status === 'current') {
    return (
      <View style={styles.dotCurrent}>
        <View style={styles.dotCurrentCore} />
      </View>
    );
  }
  return (
    <View style={styles.dotTodo}>
      <View style={styles.dotTodoCore} />
    </View>
  );
});

const TierTrack = React.memo(function TierTrack({
  tier,
  height,
}: {
  tier: SongWordTierDto;
  height: number;
}) {
  const { longTermRatio, shortTermRatio } = buildTierSegments(tier);
  const restRatio = Math.max(0, 1 - longTermRatio - shortTermRatio);

  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      {longTermRatio > 0 && <View style={[styles.longTermSegment, { flex: longTermRatio }]} />}
      {shortTermRatio > 0 && <View style={[styles.shortTermSegment, { flex: shortTermRatio }]} />}
      {restRatio > 0 && <View style={{ flex: restRatio }} />}
    </View>
  );
});

const CollapsedTierCard = React.memo(function CollapsedTierCard({
  tier,
  onExpand,
}: {
  tier: SongWordTierDto;
  onExpand: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.collapsedCard}
      onPress={onExpand}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${tier.name} 펼치기`}
    >
      <View style={styles.collapsedIntro}>
        <Text style={styles.collapsedTitle}>{tier.name}</Text>
        <Text style={styles.collapsedDesc}>{tier.description}</Text>
      </View>
      <TierTrack tier={tier} height={5} />
    </TouchableOpacity>
  );
});

const ExpandedTierCard = React.memo(function ExpandedTierCard({
  tier,
  isStartingLearning,
  onStart,
}: {
  tier: SongWordTierDto;
  isStartingLearning: boolean;
  onStart: () => void;
}) {
  const { remainingCount } = buildTierSegments(tier);
  const dueCount = Math.max(0, tier.dueCount);
  const isDisabled = dueCount === 0 || isStartingLearning;
  const minutes = estimateStudyMinutes(dueCount);

  return (
    <View style={styles.expandedCard}>
      <View style={styles.expandedIntro}>
        <Text style={styles.expandedTitle}>{tier.name}</Text>
        <Text style={styles.expandedDesc}>{tier.description}</Text>
      </View>

      <View style={styles.progress}>
        <TierTrack tier={tier} height={6} />
        <View style={styles.stats}>
          <TierStat color={Colors.memoryLongTerm} label="장기기억" value={tier.longTermCount} />
          <TierStat color={Colors.memoryShortTerm} label="단기기억" value={tier.shortTermCount} />
          <TierStat color={Colors.memoryRemaining} label="남음" value={remainingCount} muted />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.cta, isDisabled && styles.ctaDisabled]}
        onPress={onStart}
        disabled={isDisabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={dueCount > 0 ? `지금 학습할 단어 ${dueCount}개` : '모두 학습했어요!'}
      >
        {dueCount > 0 ? (
          <>
            <View style={styles.ctaCopy}>
              <Text style={styles.ctaLabel}>지금 학습할 단어 {dueCount}개</Text>
              <View style={styles.ctaTimeRow}>
                <Feather name="clock" size={11} color={CTA_SUBTLE_COLOR} />
                <Text style={styles.ctaTime}>약 {minutes}분</Text>
              </View>
            </View>
            <View style={styles.ctaPreview}>
              <SongDetailDueWordRoller words={tier.duePreviewWords} />
              <Feather name="arrow-right" size={17} color="#FFFFFF" />
            </View>
          </>
        ) : (
          <Text style={styles.ctaDisabledLabel}>모두 학습했어요!</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

const TierStat = React.memo(function TierStat({
  color,
  label,
  value,
  muted = false,
}: {
  color: string;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, muted && styles.statValueMuted]}>{value}</Text>
    </View>
  );
});

const CTA_SUBTLE_COLOR = '#FFFFFFC4';

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  sectionTitle: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 19,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    width: 26,
    alignItems: 'center',
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
  },
  connectorDone: {
    backgroundColor: Colors.primary,
  },
  dotDone: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  dotCurrent: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    borderWidth: 3,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  dotCurrentCore: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  dotTodo: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotTodoCore: {
    width: 11,
    height: 11,
    borderRadius: 9999,
    backgroundColor: Colors.memoryRemaining,
  },
  stepBody: {
    flex: 1,
  },
  stepBodyGap: {
    paddingBottom: 12,
  },

  track: {
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
    backgroundColor: Colors.tierTrack,
  },
  longTermSegment: {
    backgroundColor: Colors.memoryLongTerm,
  },
  shortTermSegment: {
    backgroundColor: Colors.memoryShortTerm,
  },

  cardShadow: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  cardShadowExpanded: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 4,
  },
  cardFrame: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFrameExpanded: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  collapsedCard: {
    gap: 9,
    padding: 14,
  },
  collapsedIntro: {
    gap: 9,
  },
  collapsedTitle: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  collapsedDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },

  expandedCard: {
    gap: 13,
    padding: 16,
  },
  expandedIntro: {
    gap: 8,
  },
  expandedTitle: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 22,
  },
  expandedDesc: {
    ...Typography.body,
    color: Colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  progress: {
    gap: 9,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
  },
  statLabel: {
    ...Typography.body,
    color: Colors.textMuted,
    fontSize: 11.5,
  },
  statValue: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontSize: 11.5,
  },
  statValueMuted: {
    color: Colors.textMuted,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    height: 60,
    paddingLeft: 18,
    paddingRight: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaDisabled: {
    justifyContent: 'center',
    backgroundColor: Colors.card,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaCopy: {
    gap: 3,
  },
  ctaLabel: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  ctaTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaTime: {
    ...Typography.bodySemiBold,
    color: CTA_SUBTLE_COLOR,
    fontSize: 11.5,
  },
  ctaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaDisabledLabel: {
    ...Typography.bodyBold,
    color: Colors.textMuted,
    fontSize: 15,
  },
});
