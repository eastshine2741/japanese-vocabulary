import React from 'react';
import { Animated, GestureResponderHandlers, Pressable, StyleSheet, View } from 'react-native';
import { CardStage, SourceHeader, StageInset } from './CardStage';
import { SWIPE_OUT_DISTANCE } from './useStudyStack';
import { WordBack } from './WordBack';
import { WordFront } from './WordFront';
import { StudyCard } from './types';

export interface WordLayerProps {
  card: StudyCard;
  /** 다음 카드 — 현재 카드 아래에 미리 깔아 스와이프 중에도 계속 보이게 한다. */
  nextCard: StudyCard | null;
  revealed: boolean;
  selectedRating: number | null;
  saving: boolean;
  translateY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onReveal: () => void;
  onRating: (rating: number) => void;
  onSourcePress: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: StageInset;
  /** 시스템 하단 영역 높이 — rating/스와이프 affordance 를 그만큼 올린다. */
  contentInsetBottom?: number;
}

/**
 * 무대는 고정, wordLayer 한 덩어리만 강체로 위로 이동한다.
 * rating 줄을 layer 안에 두어야 다음 단어에서 선택 상태가 초기화된다.
 * 다음 카드는 현재 카드 아래 깔려 있지만 평소엔 완전히 투명하다 — 두 카드 모두
 * 텍스트 뒤 배경이 비어 있어서(아트워크가 그 아래 한 장뿐), 그냥 겹쳐두면 글자가
 * 항상 그대로 겹쳐 보인다. 드래그는 SWIPE_OUT_DISTANCE까지 손가락을 그대로 따라가고,
 * opacity 는 같은 구간을 1:1로 crossfade 해서 현재 카드가 완전히 사라지는 지점에서
 * 다음 카드가 정확히 완전히 드러나도록 맞춘다.
 */
export const WordLayer = React.memo(function WordLayer({
  card,
  nextCard,
  revealed,
  selectedRating,
  saving,
  translateY,
  panHandlers,
  onReveal,
  onRating,
  onSourcePress,
  contentInsetTop,
  contentInsetBottom,
}: WordLayerProps) {
  // 크로스페이드는 전체 드래그의 80% 지점에서 끝난다 — 나머지 20%는 이미 완전히
  // 전환된 상태로 화면을 빠져나간다.
  const crossfadeStart = SWIPE_OUT_DISTANCE * 0.8;
  const opacity = translateY.interpolate({
    inputRange: [crossfadeStart, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // 평소엔 완전히 숨겨두고, 현재 카드가 사라지는 만큼 정확히 같은 비율로 드러낸다.
  const nextOpacity = translateY.interpolate({
    inputRange: [crossfadeStart, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <CardStage
      artworkUrl={card.source.artworkUrl}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <SourceHeader source={card.source} onPress={onSourcePress} />
      <View style={styles.stack}>
        {nextCard && (
          <Animated.View style={[styles.nextLayer, { opacity: nextOpacity }]} pointerEvents="none">
            <WordFront card={nextCard} />
          </Animated.View>
        )}
        <Animated.View
          style={[
            styles.wordLayer,
            { opacity, transform: [{ translateY }] },
          ]}
          {...panHandlers}
        >
          <Pressable style={styles.wordPressable} onPress={!revealed ? onReveal : undefined}>
            {!revealed ? (
              <WordFront card={card} />
            ) : (
              <WordBack
                card={card}
                selectedRating={selectedRating}
                saving={saving}
                onRating={onRating}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </CardStage>
  );
});

const styles = StyleSheet.create({
  stack: {
    flex: 1,
  },
  nextLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  wordLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  wordPressable: {
    flex: 1,
  },
});
