import React from 'react';
import { Animated, GestureResponderHandlers, Pressable, StyleSheet } from 'react-native';
import { CardStage, SourceHeader } from './CardStage';
import { WordBack } from './WordBack';
import { WordFront } from './WordFront';
import { StudyCard } from './types';

export interface WordLayerProps {
  card: StudyCard;
  revealed: boolean;
  selectedRating: number | null;
  saving: boolean;
  translateY: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onReveal: () => void;
  onRating: (rating: number) => void;
  onSourcePress: () => void;
  /** 무대 위에 얹힌 크롬 높이 — 무대 안쪽 내용만 그만큼 내려간다. */
  contentInsetTop?: number;
  /** 시스템 하단 영역 높이 — rating/스와이프 affordance 를 그만큼 올린다. */
  contentInsetBottom?: number;
}

/**
 * 무대는 고정, wordLayer 한 덩어리만 강체로 위로 이동한다.
 * rating 줄을 layer 안에 두어야 다음 단어에서 선택 상태가 초기화된다.
 */
export const WordLayer = React.memo(function WordLayer({
  card,
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
  const opacity = translateY.interpolate({
    inputRange: [-160, 0],
    outputRange: [0.25, 1],
    extrapolate: 'clamp',
  });

  return (
    <CardStage
      artworkUrl={card.source.artworkUrl}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <SourceHeader source={card.source} onPress={onSourcePress} />
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
    </CardStage>
  );
});

const styles = StyleSheet.create({
  wordLayer: {
    flex: 1,
    zIndex: 2,
  },
  wordPressable: {
    flex: 1,
  },
});
