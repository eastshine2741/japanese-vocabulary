import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CompletionStage, ErrorStage } from './CompletionStage';
import { WordLayer } from './WordLayer';
import { StudySource } from './types';
import { StudyStackState } from './useStudyStack';

export interface StudyStackProps {
  /** useStudyStack 반환값 전체. 크롬은 여기서 session/streak 를 읽는다. */
  stack: StudyStackState;
  onOpenSource: () => void;
  onSearch: () => void;
  /** 완주 화면에서 추천곡을 선택했을 때. 넘기지 않으면 추천곡 넛지를 그리지 않는다. */
  onSelectRecommended?: (source: StudySource) => void;
  /**
   * 무대 위에 겹쳐 그릴 크롬(곡 진입 오버레이 등). 홈처럼 스택 밖에 놓는 크롬은
   * 이 prop 을 쓰지 말고 StudyStack 의 형제로 배치한다.
   */
  overlay?: React.ReactNode;
  /** overlay 가 무대 위를 덮는 높이. 아트워크는 전체를 덮고 카드 내용만 내려간다. */
  contentInsetTop?: number;
}

/** 크롬에 독립적인 카드 스택. 크롬은 그리지 않는다. */
export const StudyStack = React.memo(function StudyStack({
  stack,
  onOpenSource,
  onSearch,
  onSelectRecommended,
  overlay,
  contentInsetTop,
}: StudyStackProps) {
  const {
    status,
    currentCard,
    revealed,
    selectedRating,
    saving,
    translateY,
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

  return (
    <View style={styles.stage}>
      {status === 'loading' && (
        <View style={styles.loadingLayer}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.loadingText}>오늘 볼 단어를 고르는 중</Text>
        </View>
      )}

      {isError && (
        <ErrorStage
          message={loadError}
          onRetry={reload}
          onSearch={onSearch}
          contentInsetTop={contentInsetTop}
        />
      )}

      {status === 'ready' && currentCard && (
        <WordLayer
          card={currentCard}
          revealed={revealed}
          selectedRating={selectedRating}
          saving={saving}
          translateY={translateY}
          panHandlers={panHandlers}
          onReveal={reveal}
          onRating={selectRating}
          onSourcePress={onOpenSource}
          contentInsetTop={contentInsetTop}
        />
      )}

      {isComplete && (
        <CompletionStage
          completedSource={completedSource}
          nextDueSource={nextDueSource}
          recommendedSource={recommendedSource}
          onContinueDue={continueDue}
          onRecommended={handleRecommended}
          onSearch={onSearch}
          contentInsetTop={contentInsetTop}
        />
      )}

      {status === 'ready' && currentCard && reviewError && (
        <View style={styles.reviewErrorBanner} pointerEvents="none">
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

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#14181C',
    overflow: 'hidden',
  },
  loadingLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
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
});
