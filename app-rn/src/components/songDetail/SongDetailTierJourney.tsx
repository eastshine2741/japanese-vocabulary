import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongWordTierDto, SongWordTierKey } from '../../types/song';
import { MemoryHelpSheet, MemoryHelpSheetRef } from '../memoryHelp/MemoryHelpSheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LEVEL_MATERIAL, MASTER_CHIP, SONG_MASTER_NAME, SONG_TIER_NAME, useCardFonts } from '../rewardCards/cardTheme';
import { songCardPreview, type PreviewSong } from '../rewardCards/cardPreview';
import { SongCardFront } from '../rewardCards/SongCardShowcase';
import { CardLevel, type SongRewardCard } from '../rewardCards/types';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { SongDetailDueWordRoller } from './SongDetailDueWordRoller';
import {
  buildTierSegments,
  estimateStudyMinutes,
  getSongCardProgress,
  getTierStatus,
  selectExpandedTierKey,
  type SongCardProgress,
  type SongWordTierStatus,
} from './songDetailTier';

interface SongDetailTierJourneyProps {
  song: PreviewSong;
  tiers: readonly SongWordTierDto[];
  isStartingLearning?: boolean;
  onStartTier: (tier: SongWordTierDto) => void;
}

const SWITCH_DURATION = 300;
const CONTENT_FADE_DURATION = 220;

// 펼친 단계가 바뀌면 카드 틀은 크기·위치만 옮기고 틀 안 내용만 새로 페이드인한다.
const relayout = LinearTransition.duration(SWITCH_DURATION).easing(Easing.inOut(Easing.cubic));
const contentFadeIn = FadeIn.duration(CONTENT_FADE_DURATION);

/**
 * 완곡까지 3단계. 항상 한 장만 펼쳐져 있다 — 유저가 고르기 전에는 현재 단계(한 번도 리뷰 안 한
 * 단어가 남은 첫 단계)가 펼쳐지고, 한 번 고르면 곡을 떠날 때까지 그 선택을 따른다.
 * 단계 n 을 끝내면 곡 카드 레벨 n 이라 펼친 단계에 그 카드를 보상으로 붙이고, 여정 끝에 마스터 보상을 둔다.
 * 보상을 누르면 그 레벨 카드의 견본 전시(RewardCardPreview)를 연다.
 */
export const SongDetailTierJourney = React.memo(function SongDetailTierJourney({
  song,
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

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cardProgress = useMemo(() => getSongCardProgress(tiers), [tiers]);
  const handleOpenReward = useCallback((level: CardLevel) => {
    const tier = tiers[level - 1];
    navigation.navigate('RewardCardPreview', {
      target: { kind: 'song', song, level, mastered: false },
      condition: `'${tier?.name ?? ''}' 단계 단어 모두 공부하기`,
      reached: cardProgress.level >= level,
    });
  }, [navigation, song, tiers, cardProgress.level]);
  const handleOpenMaster = useCallback(() => {
    navigation.navigate('RewardCardPreview', {
      target: { kind: 'song', song, level: 3, mastered: true },
      condition: '곡 단어의 90%를 장기 기억으로 만들기',
      reached: cardProgress.mastered,
    });
  }, [navigation, song, cardProgress.mastered]);

  if (tiers.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>완곡까지 {tiers.length}단계</Text>
      <LayoutAnimationConfig skipEntering>
        {tiers.map((tier, index) => (
          <TierStep
            key={tier.key}
            tier={tier}
            song={song}
            status={getTierStatus(tiers, index)}
            isExpanded={tier.key === expandedKey}
            isLast={index === tiers.length - 1}
            reward={rewardLevel(index)}
            isRewardReached={cardProgress.level > index}
            isStartingLearning={isStartingLearning}
            onExpand={handleExpand}
            onStartTier={onStartTier}
            onRewardPress={handleOpenReward}
          />
        ))}
        {tiers.length >= 3 && <MasterRewardBanner song={song} progress={cardProgress} onPress={handleOpenMaster} />}
      </LayoutAnimationConfig>
    </View>
  );
});

function rewardLevel(index: number): CardLevel | null {
  return index < 3 ? ((index + 1) as CardLevel) : null;
}

interface TierStepProps {
  tier: SongWordTierDto;
  song: PreviewSong;
  status: SongWordTierStatus;
  isExpanded: boolean;
  isLast: boolean;
  reward: CardLevel | null;
  isRewardReached: boolean;
  isStartingLearning: boolean;
  onExpand: (key: SongWordTierKey) => void;
  onStartTier: (tier: SongWordTierDto) => void;
  onRewardPress: (level: CardLevel) => void;
}

const TierStep = React.memo(function TierStep({
  tier,
  song,
  status,
  isExpanded,
  isLast,
  reward,
  isRewardReached,
  isStartingLearning,
  onExpand,
  onStartTier,
  onRewardPress,
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
      <View style={[styles.stepBody, styles.stepBodyGap]}>
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
                  song={song}
                  reward={reward}
                  isRewardReached={isRewardReached}
                  isStartingLearning={isStartingLearning}
                  onStart={handleStart}
                  onRewardPress={onRewardPress}
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

/** 칩 크기로는 카드가 안 읽혀서 큰 앞면의 위쪽만 줄 밖으로 잘라 보인다. */
const RewardBanner = React.memo(function RewardBanner({
  card,
  tint,
  caption,
  title,
  accessibilityLabel,
  onPress,
}: {
  card: SongRewardCard;
  tint: readonly [string, string, ...string[]];
  caption: string;
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const fonts = useCardFonts();
  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={tint}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.bannerTint]}
      />
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerCaption} numberOfLines={1}>{caption}</Text>
        <Text style={styles.bannerTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      <View style={styles.bannerCardSlot}>
        <View style={styles.bannerCard}>
          <SongCardFront card={card} width={BANNER_CARD_WIDTH} fonts={fonts} thumb />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const TierRewardBanner = React.memo(function TierRewardBanner({
  song,
  level,
  onPress,
}: {
  song: PreviewSong;
  level: CardLevel;
  onPress: (level: CardLevel) => void;
}) {
  const card = useMemo(() => songCardPreview(song, level, false), [song, level]);
  const handlePress = useCallback(() => onPress(level), [onPress, level]);
  const title = `${SONG_TIER_NAME[level]} 카드 획득`;
  return (
    <RewardBanner
      card={card}
      tint={LEVEL_MATERIAL[level].frame}
      caption="단계 완료 보상"
      title={title}
      accessibilityLabel={`단계 완료 보상 ${title}. 카드 보기`}
      onPress={handlePress}
    />
  );
});

/** 마스터는 공부할 단어 묶음이 아니라 복습으로 채워지는 기억 목표라 단계 줄에 잇지 않고 여정 끝 보상으로만 둔다. */
const MasterRewardBanner = React.memo(function MasterRewardBanner({
  song,
  progress,
  onPress,
}: {
  song: PreviewSong;
  progress: SongCardProgress;
  onPress: () => void;
}) {
  const card = useMemo(() => songCardPreview(song, 3, true), [song]);
  const percent = Math.round(progress.longTermRatio * 100);
  const caption = progress.mastered
    ? '받은 카드'
    : progress.level < 3
      ? '완곡 후, 단어의 90%를 장기기억 시'
      : `단어의 90%를 장기기억 시 (지금 ${percent}%)`;
  const title = progress.mastered ? `${SONG_MASTER_NAME} 카드` : `${SONG_MASTER_NAME} 카드 획득`;
  return (
    <Animated.View layout={relayout}>
      <RewardBanner
        card={card}
        tint={MASTER_CHIP.frame}
        caption={caption}
        title={title}
        accessibilityLabel={`${caption} ${title}. 카드 보기`}
        onPress={onPress}
      />
    </Animated.View>
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

interface TierRewardProps {
  reward: CardLevel | null;
  isRewardReached: boolean;
  onRewardPress: (level: CardLevel) => void;
}

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
  song,
  reward,
  isRewardReached,
  isStartingLearning,
  onStart,
  onRewardPress,
}: {
  tier: SongWordTierDto;
  song: PreviewSong;
  isStartingLearning: boolean;
  onStart: () => void;
} & TierRewardProps) {
  const { remainingCount } = buildTierSegments(tier);
  const dueCount = Math.max(0, tier.dueCount);
  const isDisabled = dueCount === 0 || isStartingLearning;
  const minutes = estimateStudyMinutes(dueCount);
  const helpSheetRef = useRef<MemoryHelpSheetRef>(null);
  const handleOpenHelp = useCallback(() => helpSheetRef.current?.present(), []);

  return (
    <View style={styles.expandedCard}>
      <View style={styles.expandedIntro}>
        <Text style={styles.expandedTitle}>{tier.name}</Text>
        <Text style={styles.expandedDesc}>{tier.description}</Text>
      </View>

      <View style={styles.progress}>
        <TierTrack tier={tier} height={6} />
        <TouchableOpacity
          style={styles.stats}
          onPress={handleOpenHelp}
          activeOpacity={0.6}
          hitSlop={STAT_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`장기기억 ${tier.longTermCount}, 단기기억 ${tier.shortTermCount}, 남음 ${remainingCount}. 설명 보기`}
        >
          <TierStat color={Colors.memoryLongTerm} label="장기기억" value={tier.longTermCount} />
          <TierStat color={Colors.memoryShortTerm} label="단기기억" value={tier.shortTermCount} />
          <TierStat color={Colors.memoryRemaining} label="남음" value={remainingCount} muted />
          <Feather name="info" size={12} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <MemoryHelpSheet ref={helpSheetRef} />

      {reward != null && !isRewardReached && (
        <TierRewardBanner song={song} level={reward} onPress={onRewardPress} />
      )}

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
            <SongDetailDueWordRoller words={tier.duePreviewWords} />
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
const BANNER_HEIGHT = 60;
const BANNER_CARD_WIDTH = 64;
const STAT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

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

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: BANNER_HEIGHT,
    paddingLeft: 14,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  bannerTint: {
    opacity: 0.22,
  },
  bannerCopy: {
    flex: 1,
    gap: 2,
  },
  bannerCaption: {
    ...Typography.bodySemiBold,
    color: Colors.textSecondary,
    fontSize: 11.5,
  },
  bannerTitle: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  bannerCardSlot: {
    alignSelf: 'stretch',
    width: BANNER_CARD_WIDTH,
    marginRight: 14,
  },
  bannerCard: {
    marginTop: 10,
    borderRadius: BANNER_CARD_WIDTH * 0.046,
    overflow: 'hidden',
    transform: [{ rotate: '-4deg' }],
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
    alignSelf: 'flex-start',
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
  ctaDisabledLabel: {
    ...Typography.bodyBold,
    color: Colors.textMuted,
    fontSize: 15,
  },
});
