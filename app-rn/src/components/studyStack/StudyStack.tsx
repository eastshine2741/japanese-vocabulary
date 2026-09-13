import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SkeletonBox from '../SkeletonLoading';
import { CardStage, StageInset } from './CardStage';
import { CompletionStage, ErrorStage } from './CompletionStage';
import { WordLayer } from './WordLayer';
import { StudySource } from './types';
import { StudyStackState } from './useStudyStack';

export interface StudyStackProps {
  /** useStudyStack 반환값 전체. 크롬은 여기서 session/streak 를 읽는다. */
  stack: StudyStackState;
  onOpenSource: () => void;
  /** 예문 캐러셀에서 그 예문이 나온 곡(카드 자체 source 와 다를 수 있다)으로 이동할 때. */
  onOpenExampleSource?: (songId: number) => void;
  onSearch: () => void;
  /** 완주 화면에서 추천곡을 선택했을 때. 넘기지 않으면 추천곡 넛지를 그리지 않는다. */
  onSelectRecommended?: (source: StudySource) => void;
  /**
   * 무대 위에 겹쳐 그릴 크롬(곡 진입 오버레이 등). 홈처럼 스택 밖에 놓는 크롬은
   * 이 prop 을 쓰지 말고 StudyStack 의 형제로 배치한다.
   */
  overlay?: React.ReactNode;
  /** overlay 가 무대 위를 덮는 높이. 아트워크는 전체를 덮고 카드 내용만 내려간다. */
  contentInsetTop?: StageInset;
  /** 시스템 하단 영역이 무대 위를 덮는 높이. 하단 컨트롤만 그만큼 올린다. */
  contentInsetBottom?: number;
  /** 홈 확장 상태처럼 카드 조작 전에 먼저 immersive 전환이 필요한 경우. */
  requireImmersedInteraction?: boolean;
  onRequestImmerse?: () => void;
}

/** 크롬에 독립적인 카드 스택. 크롬은 그리지 않는다. */
export const StudyStack = React.memo(function StudyStack({
  stack,
  onOpenSource,
  onOpenExampleSource,
  onSearch,
  onSelectRecommended,
  overlay,
  contentInsetTop,
  contentInsetBottom,
  requireImmersedInteraction = false,
  onRequestImmerse,
}: StudyStackProps) {
  const {
    status,
    cards,
    currentIndex,
    currentCard,
    revealed,
    selectedRating,
    saving,
    translateY,
    revealProgress,
    panHandlers,
    isComplete,
    isError,
    loadError,
    reviewError,
    completedSource,
    nextDueSource,
    recommendedSource,
    reveal,
    selectRating,
    reload,
    continueDue,
  } = stack;

  const handleRecommended = useCallback(() => {
    if (recommendedSource) onSelectRecommended?.(recommendedSource);
  }, [onSelectRecommended, recommendedSource]);

  const nextCard = cards[currentIndex + 1] ?? null;
  const lastCardArtworkUrlRef = useRef<string | null>(currentCard?.source.artworkUrl ?? null);
  const wasCompleteRef = useRef(false);
  const completionEntranceProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentCard) {
      lastCardArtworkUrlRef.current = currentCard.source.artworkUrl;
    }
  }, [currentCard]);

  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      completionEntranceProgress.setValue(0);
      Animated.timing(completionEntranceProgress, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!isComplete) {
      completionEntranceProgress.setValue(0);
    }
    wasCompleteRef.current = isComplete;
  }, [completionEntranceProgress, isComplete]);

  return (
    <View style={styles.stage}>
      {status === 'loading' && (
        <StudyStackLoadingSkeleton
          contentInsetTop={contentInsetTop}
          contentInsetBottom={contentInsetBottom}
        />
      )}

      {isError && (
        <ErrorStage
          message={loadError}
          onRetry={reload}
          onSearch={onSearch}
          contentInsetTop={contentInsetTop}
          contentInsetBottom={contentInsetBottom}
        />
      )}

      {status === 'ready' && currentCard && (
        <WordLayer
          card={currentCard}
          nextCard={nextCard}
          revealed={revealed}
          selectedRating={selectedRating}
          saving={saving}
          translateY={translateY}
          revealProgress={revealProgress}
          panHandlers={panHandlers}
          onReveal={reveal}
          onRating={selectRating}
          onSourcePress={onOpenSource}
          onOpenExampleSource={onOpenExampleSource}
          requireImmersedInteraction={requireImmersedInteraction}
          onRequestImmerse={onRequestImmerse}
          contentInsetTop={contentInsetTop}
          contentInsetBottom={contentInsetBottom}
        />
      )}

      {isComplete && (
        <CompletionStage
          completedSource={completedSource}
          nextDueSource={nextDueSource}
          recommendedSource={recommendedSource}
          previousArtworkUrl={lastCardArtworkUrlRef.current}
          entranceProgress={completionEntranceProgress}
          onContinueDue={continueDue}
          onRecommended={handleRecommended}
          onSearch={onSearch}
          contentInsetTop={contentInsetTop}
          contentInsetBottom={contentInsetBottom}
        />
      )}

      {status === 'ready' && currentCard && reviewError && (
        <View
          style={[
            styles.reviewErrorBanner,
            contentInsetBottom ? { bottom: REVIEW_ERROR_BOTTOM_OFFSET + contentInsetBottom } : null,
          ]}
          pointerEvents="none"
        >
          <Feather name="alert-circle" size={14} color="#FFD4D4" />
          <Text numberOfLines={2} style={styles.reviewErrorText}>{reviewError}</Text>
        </View>
      )}

      {overlay != null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {overlay}
        </View>
      )}
    </View>
  );
});

const REVIEW_ERROR_BOTTOM_OFFSET = 24;
const SKELETON_RATING_BUTTONS = [0, 1, 2, 3];

interface StudyStackLoadingSkeletonProps {
  contentInsetTop?: StageInset;
  contentInsetBottom?: number;
}

const StudyStackLoadingSkeleton = React.memo(function StudyStackLoadingSkeleton({
  contentInsetTop,
  contentInsetBottom,
}: StudyStackLoadingSkeletonProps) {
  return (
    <CardStage
      artworkUrl={null}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <View pointerEvents="none" style={styles.skeletonGrayBackground} />
      <View pointerEvents="none" style={styles.skeletonSourceRow}>
        <SkeletonBox width={40} height={40} borderRadius={8} color="rgba(255,255,255,0.18)" />
        <View style={styles.skeletonSourceTextCol}>
          <SkeletonBox width="56%" height={14} borderRadius={4} color="rgba(255,255,255,0.22)" />
          <SkeletonBox width="34%" height={11} borderRadius={4} color="rgba(255,255,255,0.14)" />
        </View>
        <SkeletonBox width={16} height={16} borderRadius={8} color="rgba(255,255,255,0.12)" />
      </View>

      <View pointerEvents="none" style={styles.skeletonStack}>
        <View style={styles.skeletonWordGroup}>
          <SkeletonBox width="68%" height={64} borderRadius={10} color="rgba(255,255,255,0.24)" />
          <View style={styles.skeletonHintRow}>
            <SkeletonBox width={16} height={16} borderRadius={8} color="rgba(255,255,255,0.18)" />
            <SkeletonBox width={132} height={12} borderRadius={4} color="rgba(255,255,255,0.16)" />
          </View>
        </View>

        <View style={styles.skeletonRatingRow}>
          {SKELETON_RATING_BUTTONS.map((rating) => (
            <View key={rating} style={styles.skeletonRatingButton}>
              <SkeletonBox width="54%" height={12} borderRadius={4} color="rgba(255,255,255,0.20)" />
              <SkeletonBox width="42%" height={10} borderRadius={4} color="rgba(255,255,255,0.13)" />
            </View>
          ))}
        </View>
      </View>
    </CardStage>
  );
});

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#14181C',
    overflow: 'hidden',
  },
  reviewErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: REVIEW_ERROR_BOTTOM_OFFSET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(58,22,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,212,0.34)',
  },
  reviewErrorText: {
    flex: 1,
    color: '#FFD4D4',
    fontSize: 13,
    lineHeight: 18,
  },
  skeletonGrayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6B7178',
  },
  skeletonSourceRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonSourceTextCol: {
    flex: 1,
    gap: 7,
  },
  skeletonStack: {
    flex: 1,
  },
  skeletonWordGroup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
  },
  skeletonHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skeletonRatingRow: {
    height: 48,
    flexDirection: 'row',
    gap: 8,
  },
  skeletonRatingButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});
