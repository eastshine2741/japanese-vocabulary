import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ArtworkThumb, CardStage } from './CardStage';
import { StudySource } from './types';

export interface CompletionStageProps {
  completedSource: StudySource | null;
  nextDueSource: StudySource | null;
  recommendedSource: StudySource | null;
  onContinueDue: () => void;
  onRecommended: () => void;
  onSearch: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: number;
  /** 시스템 하단 영역 높이 — CTA 영역을 그만큼 올린다. */
  contentInsetBottom?: number;
}

/** 완주 카드 — 다음 due 넛지 / 전체 복습 완료 두 변형. 무대 자체가 다음 곡으로 바뀐다. */
export const CompletionStage = React.memo(function CompletionStage({
  completedSource,
  nextDueSource,
  recommendedSource,
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
  const completeTitle = hasNextDue && completedSource
    ? `${completedSource.title} 완주!`
    : hasRecommended
      ? '오늘 복습 끝!'
      : '지금 복습할 단어가 없어요';
  const completeSub = hasNextDue && completedSource
    ? `이 곡 단어 ${completedSource.totalCount}개를 전부 복습했어요`
    : hasRecommended
      ? '대단해요! 오늘의 모든 단어를 복습했어요'
      : '다음 복습 시간이 되면 카드가 다시 나타나요';

  if (!stageSource) {
    return (
      <CardStage
        artworkUrl={null}
        contentInsetTop={contentInsetTop}
        contentInsetBottom={contentInsetBottom}
      >
        <View style={styles.completeCenter}>
          <View style={styles.doneBadge}>
            <Feather name="check" size={32} color="#A7E3C4" />
          </View>
          <View style={styles.doneGroup}>
            <Text style={styles.doneTitle}>지금 복습할 단어가 없어요</Text>
            <View style={styles.doneSubRow}>
              <Feather name="check-circle" size={15} color="#A7E3C4" />
              <Text style={styles.doneSub}>새로 배울 곡을 검색해보세요</Text>
            </View>
          </View>
        </View>
        <View style={styles.completeBottom}>
          <Pressable style={styles.primaryAction} onPress={onSearch}>
            <Text style={styles.primaryActionText}>새 곡 검색</Text>
          </Pressable>
        </View>
      </CardStage>
    );
  }

  return (
    <CardStage
      artworkUrl={stageSource.artworkUrl}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <View style={styles.completeCenter}>
        {hasNextDue || completedSource ? (
          <ArtworkThumb artworkUrl={(completedSource ?? stageSource).artworkUrl} size={72} radius={14} />
        ) : (
          <View style={styles.doneBadge}>
            <Feather name="check" size={32} color="#A7E3C4" />
          </View>
        )}
        <View style={styles.doneGroup}>
          <Text style={styles.doneTitle}>
            {completeTitle}
          </Text>
          <View style={styles.doneSubRow}>
            <Feather name="check-circle" size={15} color="#A7E3C4" />
            <Text numberOfLines={2} style={styles.doneSub}>
              {completeSub}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.completeBottom}>
        {(hasNextDue || hasRecommended) && (
          <>
            <View style={styles.nudgeDivider} />
            <View style={styles.nudgeBlock}>
              <Text style={styles.nudgeReason}>
                {hasNextDue ? '복습할 단어가 남은 곡이 하나 더 있어요' : '새 단어를 배울 곡을 골라봤어요'}
              </Text>
              <View style={styles.nextSourceRow}>
                <ArtworkThumb artworkUrl={stageSource.artworkUrl} size={34} radius={7} />
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
            {hasNextDue && hasRecommended && (
              <Pressable style={styles.secondaryAction} onPress={onRecommended}>
                <Feather name="book-open" size={15} color="rgba(255,255,255,0.6)" />
                <Text style={styles.secondaryActionText}>추천곡 학습</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryAction} onPress={onSearch}>
              <Feather name="search" size={15} color="rgba(255,255,255,0.6)" />
              <Text style={styles.secondaryActionText}>새 곡 검색</Text>
            </Pressable>
          </View>
        )}
      </View>
    </CardStage>
  );
});

export interface ErrorStageProps {
  message: string | null;
  onRetry: () => void;
  onSearch: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: number;
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
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
