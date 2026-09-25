import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { ArtworkThumb, CardStage, StageInset } from './CardStage';
import { EMPTY_MEMORY_DIFF, StudyMemoryDiff, StudySource } from './types';

export interface CompletionStageProps {
  completedSource: StudySource | null;
  nextDueSource: StudySource | null;
  recommendedSource: StudySource | null;
  previousArtworkUrl?: string | null;
  entranceProgress?: Animated.Value;
  /** 이번 세션에서 기억 칸이 실제로 바뀐 단어 수. 리뷰가 한 건도 없으면 이 블록은 그리지 않는다. */
  memoryDiff?: StudyMemoryDiff;
  /** 이번 세션에서 복습을 마친 카드 수. 0 이면 보여줄 성과가 없다. */
  sessionReviewedCount?: number;
  onContinueDue: () => void;
  onRecommended: () => void;
  onSearch: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: StageInset;
  /** 시스템 하단 영역 높이 — CTA 영역을 그만큼 올린다. */
  contentInsetBottom?: number;
}

/** 완주 카드 — 다음 due 넛지 / 전체 복습 완료 두 변형. 무대 자체가 다음 곡으로 바뀐다. */
export const CompletionStage = React.memo(function CompletionStage({
  completedSource,
  nextDueSource,
  recommendedSource,
  previousArtworkUrl,
  entranceProgress,
  memoryDiff = EMPTY_MEMORY_DIFF,
  sessionReviewedCount = 0,
  onContinueDue,
  onRecommended,
  onSearch,
  contentInsetTop,
  contentInsetBottom,
}: CompletionStageProps) {
  const stageSource = nextDueSource ?? recommendedSource ?? completedSource;
  const hasNextDue = nextDueSource != null;
  const hasRecommended = recommendedSource != null;
  const primaryLabel = hasNextDue ? '이어서 복습' : hasRecommended ? '이어서 학습' : '새 곡 검색';
  const handlePrimary = hasNextDue ? onContinueDue : hasRecommended ? onRecommended : onSearch;
  // 완주(다음 due 곡이 남음)가 아니면 추천곡 넛지 유무와 무관하게 같은 문구다 — 한 장도
  // 복습하지 않은 사용자에게도 이 화면이 뜨므로 '오늘 다 했다'고 단정하지 않는다.
  const completeTitle = hasNextDue && completedSource
    ? `${completedSource.title} 완주!`
    : '복습할 단어가 없어요';
  const completeSub = hasNextDue && completedSource
    ? `이 곡의 ${completedSource.totalCount}개 단어를 복습했어요`
    : '다음 복습 시간이 되면 카드가 다시 나타나요';
  const showMemoryStats = sessionReviewedCount > 0;
  const coverEntranceStyle = entranceProgress
    ? {
        opacity: entranceProgress.interpolate({
          inputRange: [0, 0.12, 0.34],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            scale: entranceProgress.interpolate({
              inputRange: [0, 0.12, 0.38, 0.52],
              outputRange: [0.64, 0.64, 1.08, 1],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;
  // 커버 뒤에서 한 번 퍼져 나가는 링. 완주했다는 신호를 가장 먼저 준다.
  const coverHaloStyle = entranceProgress
    ? {
        opacity: entranceProgress.interpolate({
          inputRange: [0, 0.14, 0.3, 0.6],
          outputRange: [0, 0.55, 0.32, 0],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            scale: entranceProgress.interpolate({
              inputRange: [0, 0.14, 0.6],
              outputRange: [0.7, 0.9, 2],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;
  const statsEntranceStyle = entranceProgress
    ? {
        opacity: entranceProgress.interpolate({
          inputRange: [0, 0.46, 0.74],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: entranceProgress.interpolate({
              inputRange: [0, 0.46, 0.82],
              outputRange: [22, 22, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;
  const centerEntranceStyle = entranceProgress
    ? {
        opacity: entranceProgress.interpolate({
          inputRange: [0, 0.26, 0.54],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: entranceProgress.interpolate({
              inputRange: [0, 0.26, 0.62],
              outputRange: [18, 18, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;
  const bottomEntranceStyle = entranceProgress
    ? {
        opacity: entranceProgress.interpolate({
          inputRange: [0, 0.66, 1],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        }),
        transform: [
          {
            translateY: entranceProgress.interpolate({
              inputRange: [0, 0.66, 1],
              outputRange: [24, 24, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
      }
    : null;

  if (!stageSource) {
    return (
      <CardStage
        artworkUrl={null}
        previousArtworkUrl={previousArtworkUrl}
        artworkTransitionProgress={entranceProgress}
        contentInsetTop={contentInsetTop}
        contentInsetBottom={contentInsetBottom}
      >
        <Animated.View style={[styles.completeCenter, centerEntranceStyle]}>
          <View style={styles.doneBadge}>
            <Feather name="check" size={32} color="#A7E3C4" />
          </View>
          <View style={styles.doneGroup}>
            <Text style={styles.doneTitle}>복습할 단어가 없어요</Text>
            <View style={styles.doneSubRow}>
              <Feather name="check-circle" size={15} color="#A7E3C4" />
              <Text style={styles.doneSub}>새로 배울 곡을 검색해보세요</Text>
            </View>
          </View>
        </Animated.View>
        <Animated.View style={[styles.completeBottom, bottomEntranceStyle]}>
          <Pressable style={styles.primaryAction} onPress={onSearch}>
            <Text style={styles.primaryActionText}>새 곡 검색</Text>
          </Pressable>
        </Animated.View>
      </CardStage>
    );
  }

  return (
    <CardStage
      artworkUrl={stageSource.artworkUrl}
      previousArtworkUrl={previousArtworkUrl}
      artworkTransitionProgress={entranceProgress}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <View style={styles.completeCenter}>
        <Animated.View style={[styles.coverWrap, coverEntranceStyle]}>
          <Animated.View pointerEvents="none" style={[styles.coverHalo, coverHaloStyle]} />
          {hasNextDue || completedSource ? (
            <ArtworkThumb artworkUrl={(completedSource ?? stageSource).artworkUrl} size={72} radius={14} />
          ) : (
            <View style={styles.doneBadge}>
              <Feather name="check" size={32} color="#A7E3C4" />
            </View>
          )}
        </Animated.View>
        <Animated.View style={[styles.doneGroup, centerEntranceStyle]}>
          <Text style={styles.doneTitle}>
            {completeTitle}
          </Text>
          <View style={styles.doneSubRow}>
            <Feather name="check-circle" size={15} color="#A7E3C4" />
            <Text numberOfLines={2} style={styles.doneSub}>
              {completeSub}
            </Text>
          </View>
        </Animated.View>

        {showMemoryStats && (
          <Animated.View style={[styles.sessionStats, statsEntranceStyle]}>
            <MemoryStat
              value={memoryDiff.toLongTerm}
              label="장기기억으로"
              color={Colors.memoryLongTerm}
              glowColor="rgba(22,179,100,0.50)"
              startDelay={MEMORY_COUNT_START_MS}
            />
            <View style={styles.statDivider} />
            <MemoryStat
              value={memoryDiff.toShortTerm}
              label="단기기억으로"
              color={Colors.memoryShortTerm}
              glowColor="rgba(34,184,207,0.50)"
              startDelay={MEMORY_COUNT_START_MS + MEMORY_COUNT_STAGGER_MS}
            />
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.completeBottom, bottomEntranceStyle]}>
        {(hasNextDue || hasRecommended) && (
          <>
            <View style={styles.nudgeDivider} />
            <View style={styles.nudgeBlock}>
              <Text style={styles.nudgeReason}>
                {hasNextDue ? '복습할 단어가 남은 곡이 하나 더 있어요' : '새 단어를 배울 곡을 골라봤어요'}
              </Text>
              <View style={styles.nextSourceRow}>
                <ArtworkThumb artworkUrl={stageSource.artworkUrl} size={40} radius={8} />
                <View style={styles.nextSourceText}>
                  <Text numberOfLines={1} style={styles.nextTitle}>{stageSource.title}</Text>
                  <Text numberOfLines={1} style={styles.nextSub}>
                    {stageSource.artist} · {hasNextDue ? `오늘 ${stageSource.dueCount}개 남음` : `배울 단어 ${stageSource.totalCount}개`}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.primaryAction} onPress={handlePrimary}>
          <Text style={styles.primaryActionText}>{primaryLabel}</Text>
        </Pressable>

        {(hasNextDue || hasRecommended) && (
          <View style={styles.secondaryActions}>
            <Pressable style={styles.secondaryAction} onPress={onSearch}>
              <Feather name="search" size={15} color="rgba(255,255,255,0.6)" />
              <Text style={styles.secondaryActionText}>새 곡 검색</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </CardStage>
  );
});

/** 숫자가 굴러가기 시작하는 시점 — 통계 블록이 올라오는 동안 함께 굴러간다. */
const MEMORY_COUNT_START_MS = 560;
/** 두 숫자가 동시에 올라가면 한 덩어리로 보인다. 장기기억 쪽을 먼저 굴린다. */
const MEMORY_COUNT_STAGGER_MS = 220;
/** 한 칸 올라가는 데 드는 시간. 숫자가 커도 아래 상한을 넘지 않는다. */
const MEMORY_COUNT_PER_STEP_MS = 90;
const MEMORY_COUNT_MAX_MS = 1000;

interface MemoryStatProps {
  value: number;
  label: string;
  color: string;
  glowColor: string;
  startDelay: number;
}

/**
 * 기억 이동 한 칸. 0 에서 `value` 까지 숫자를 굴려 올린 뒤 한 번 튕긴다.
 *
 * 숫자는 텍스트라 Animated 로 직접 못 그린다 — Animated.Value 를 듣다가 반올림 값이 **바뀔 때만**
 * setState 해서, 프레임마다가 아니라 숫자가 실제로 넘어갈 때만 렌더한다.
 */
const MemoryStat = React.memo(function MemoryStat({
  value,
  label,
  color,
  glowColor,
  startDelay,
}: MemoryStatProps) {
  const [display, setDisplay] = useState(0);
  const count = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDisplay(0);
    count.setValue(0);
    pop.setValue(0);
    if (value <= 0) return;

    let shown = 0;
    const listener = count.addListener(({ value: raw }) => {
      const next = Math.round(raw);
      if (next === shown) return;
      shown = next;
      setDisplay(next);
    });
    const anim = Animated.sequence([
      Animated.delay(startDelay),
      Animated.timing(count, {
        toValue: value,
        duration: Math.min(MEMORY_COUNT_MAX_MS, value * MEMORY_COUNT_PER_STEP_MS + 180),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pop, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
    ]);
    anim.start();
    return () => {
      anim.stop();
      count.removeListener(listener);
    };
  }, [count, pop, startDelay, value]);

  const popStyle = {
    transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
  };
  const glow = { textShadowColor: glowColor, textShadowOffset: NO_OFFSET, textShadowRadius: 16 };

  return (
    <View style={styles.memoryStat}>
      <Animated.View style={[styles.memoryValueRow, popStyle]}>
        <Text style={[styles.memoryValue, { color }, glow]}>+{display}</Text>
        <Text style={[styles.memoryUnit, { color }, glow]}>개</Text>
      </Animated.View>
      <Text style={styles.memoryLabel}>{label}</Text>
    </View>
  );
});

const NO_OFFSET = { width: 0, height: 0 };

export interface ErrorStageProps {
  message: string | null;
  onRetry: () => void;
  onSearch: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: StageInset;
  /** 시스템 하단 영역 높이 — CTA 영역을 그만큼 올린다. */
  contentInsetBottom?: number;
}

export const ErrorStage = React.memo(function ErrorStage({
  message,
  onRetry,
  onSearch,
  contentInsetTop,
  contentInsetBottom,
}: ErrorStageProps) {
  return (
    <CardStage
      artworkUrl={null}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <View style={styles.completeCenter}>
        <View style={styles.errorBadge}>
          <Feather name="wifi-off" size={30} color="#FFD4D4" />
        </View>
        <View style={styles.doneGroup}>
          <Text style={styles.doneTitle}>오늘 복습을 불러오지 못했어요</Text>
          <View style={styles.doneSubRow}>
            <Text numberOfLines={3} style={styles.doneSub}>
              {message ?? '네트워크 상태를 확인한 뒤 다시 시도해 주세요'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.completeBottom}>
        <Pressable style={styles.primaryAction} onPress={onRetry}>
          <Text style={styles.primaryActionText}>다시 시도</Text>
        </Pressable>
        <View style={styles.secondaryActions}>
          <Pressable style={styles.secondaryAction} onPress={onSearch}>
            <Feather name="search" size={15} color="rgba(255,255,255,0.6)" />
            <Text style={styles.secondaryActionText}>새 곡 검색</Text>
          </Pressable>
        </View>
      </View>
    </CardStage>
  );
});

const styles = StyleSheet.create({
  completeCenter: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    zIndex: 2,
  },
  coverWrap: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(167,227,196,0.9)',
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  memoryStat: {
    gap: 4,
  },
  memoryValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  memoryValue: {
    ...Typography.headingBold,
    fontSize: 38,
    lineHeight: 38,
    letterSpacing: -1,
  },
  memoryUnit: {
    ...Typography.bodySemiBold,
    fontSize: 15,
    lineHeight: 22,
  },
  memoryLabel: {
    ...Typography.bodySemiBold,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13,
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,24,28,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(167,227,196,0.48)',
  },
  errorBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,24,28,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,212,0.48)',
  },
  doneGroup: {
    gap: 8,
  },
  doneTitle: {
    ...Typography.headingBold,
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 37,
    letterSpacing: 0,
  },
  doneSubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  doneSub: {
    flex: 1,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  completeBottom: {
    gap: 16,
    zIndex: 2,
  },
  nudgeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  nudgeBlock: {
    gap: 10,
  },
  nudgeReason: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  nextSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextSourceText: {
    flex: 1,
    gap: 2,
  },
  nextTitle: {
    ...Typography.headingSemiBold,
    color: '#FFFFFF',
    fontSize: 17,
  },
  nextSub: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryAction: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#14181C',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActions: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 96,
  },
  secondaryActionText: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 13,
    fontWeight: '600',
  },
});
