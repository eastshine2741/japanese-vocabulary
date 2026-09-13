import React from 'react';
import { Animated, GestureResponderHandlers, Pressable, StyleSheet, Text, View } from 'react-native';
import { CardStage, SourceHeader, StageInset } from './CardStage';
import { SWIPE_OUT_DISTANCE } from './useStudyStack';
import { WordBack } from './WordBack';
import { WordFront } from './WordFront';
import { StudyCard } from './types';

/** 앞면 headword 자리에서 뒷면 자리로 가는 변환. faceStack 기준 측정값의 차. */
interface HeadwordMorph {
  dx: number;
  dy: number;
  scale: number;
}

export interface WordLayerProps {
  card: StudyCard;
  /** 다음 카드 — 현재 카드 아래에 미리 깔아 스와이프 중에도 계속 보이게 한다. */
  nextCard: StudyCard | null;
  revealed: boolean;
  selectedRating: number | null;
  saving: boolean;
  translateY: Animated.Value;
  revealProgress: Animated.Value;
  panHandlers: GestureResponderHandlers;
  onReveal: () => void;
  onRating: (rating: number) => void;
  onSourcePress: () => void;
  onOpenExampleSource?: (songId: number) => void;
  /** 카드 전체를 잠근다 — 탭이면 onRequestImmerse 만 부르고, 나머지 터치는 카드에 닿지 않는다. */
  requireImmersedInteraction?: boolean;
  onRequestImmerse?: () => void;
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
  revealProgress,
  panHandlers,
  onReveal,
  onRating,
  onSourcePress,
  onOpenExampleSource,
  requireImmersedInteraction = false,
  onRequestImmerse,
  contentInsetTop,
  contentInsetBottom,
}: WordLayerProps) {
  const faceStackRef = React.useRef<View>(null);
  const frontHeadwordRef = React.useRef<View>(null);
  const backHeadwordRef = React.useRef<View>(null);
  const affordanceProgress = React.useRef(new Animated.Value(0)).current;
  // 공유 headword 는 앞면 앵커 안에 그린다. 절대 좌표로 놓으면 몰입 드래그로 카드 안쪽
  // 여백이 매 프레임 바뀔 때 측정(onLayout → rAF → measureLayout → setState)이 한 박자
  // 늦게 따라와 headword 가 튄다. 앵커 안에 있으면 레이아웃과 같은 프레임에 움직이고,
  // 측정에서 필요한 건 앞→뒤 morph(둘 다 세로 중앙 정렬이라 여백이 바뀌어도 일정하다)뿐이다.
  const [headwordMorph, setHeadwordMorph] = React.useState<HeadwordMorph | null>(null);

  React.useEffect(() => {
    setHeadwordMorph(null);
  }, [card.id]);

  const measureHeadwords = React.useCallback(() => {
    requestAnimationFrame(() => {
      const faceStack = faceStackRef.current;
      const front = frontHeadwordRef.current;
      const back = backHeadwordRef.current;
      if (!faceStack || !front || !back) return;
      front.measureLayout(faceStack, (fx, fy, fw) => {
        back.measureLayout(faceStack, (bx, by, bw) => {
          const next = { dx: bx - fx, dy: by - fy, scale: fw > 0 ? bw / fw : 44 / 64 };
          setHeadwordMorph(prev => (
            prev && prev.dx === next.dx && prev.dy === next.dy && prev.scale === next.scale
              ? prev
              : next
          ));
        }, () => undefined);
      }, () => undefined);
    });
  }, []);

  const sharedHeadwordReady = headwordMorph != null;
  // interpolate 는 렌더마다 새로 만들면 네이티브 Animated 노드를 떼고 다시 붙인다 — 값이 바뀔 때만.
  const sharedHeadwordStyle = React.useMemo(() => {
    if (!headwordMorph) return null;
    const backHeadwordAffordanceShift = affordanceProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -24.5],
      extrapolate: 'clamp',
    });
    return {
      transform: [
        {
          translateX: revealProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, headwordMorph.dx],
            extrapolate: 'clamp',
          }),
        },
        {
          translateY: Animated.add(
            revealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, headwordMorph.dy],
              extrapolate: 'clamp',
            }),
            backHeadwordAffordanceShift,
          ),
        },
        {
          scale: revealProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, headwordMorph.scale],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [affordanceProgress, headwordMorph, revealProgress]);
  const sharedHeadword = React.useMemo(() => sharedHeadwordStyle && (
    <Animated.View pointerEvents="none" style={[styles.sharedHeadwordLayer, sharedHeadwordStyle]}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.sharedHeadword}>
        {card.japanese}
      </Text>
    </Animated.View>
  ), [card.japanese, sharedHeadwordStyle]);
  // 크로스페이드는 전체 드래그의 80% 지점에서 끝난다 — 나머지 20%는 이미 완전히
  // 전환된 상태로 화면을 빠져나간다.
  // 평소엔 다음 카드를 완전히 숨겨두고, 현재 카드가 사라지는 만큼 정확히 같은 비율로 드러낸다.
  const { opacity, nextOpacity } = React.useMemo(() => {
    const crossfadeStart = SWIPE_OUT_DISTANCE * 0.8;
    return {
      opacity: translateY.interpolate({
        inputRange: [crossfadeStart, 0],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
      nextOpacity: translateY.interpolate({
        inputRange: [crossfadeStart, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    };
  }, [translateY]);
  const faceStack = (
    <View ref={faceStackRef} collapsable={false} style={styles.faceStack} onLayout={measureHeadwords}>
      <View style={StyleSheet.absoluteFill} pointerEvents={revealed ? 'auto' : 'none'}>
        <WordBack
          card={card}
          selectedRating={selectedRating}
          saving={saving}
          onRating={onRating}
          revealProgress={revealProgress}
          affordanceProgress={affordanceProgress}
          hideHeadword={sharedHeadwordReady}
          headwordRef={backHeadwordRef}
          onHeadwordLayout={measureHeadwords}
          onOpenExampleSource={onOpenExampleSource}
        />
      </View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WordFront
          card={card}
          revealProgress={revealProgress}
          hideHeadword={sharedHeadwordReady}
          headwordRef={frontHeadwordRef}
          onHeadwordLayout={measureHeadwords}
          headwordOverlay={sharedHeadword}
        />
      </View>
    </View>
  );

  return (
    <CardStage
      artworkUrl={card.source.artworkUrl}
      contentInsetTop={contentInsetTop}
      contentInsetBottom={contentInsetBottom}
    >
      <SourceHeader source={card.source} onPress={onSourcePress} />
      <View key={card.id} style={styles.stack}>
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
          {/* 뒤집힌 뒤에도 같은 Pressable 을 유지한다 — View 로 바꿔 끼우면 부모 타입이 달라져
              faceStack(예문 ScrollView·rating 버튼 전부)이 reveal 애니메이션 시작과 동시에
              언마운트/재마운트된다. disabled 면 responder 를 잡지 않아 안쪽 터치는 그대로 통한다. */}
          <Pressable style={styles.wordPressable} onPress={onReveal} disabled={revealed}>
            {faceStack}
          </Pressable>
        </Animated.View>
      </View>
      {requireImmersedInteraction && (
        <Pressable style={styles.interactionLock} onPress={onRequestImmerse} />
      )}
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
  interactionLock: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  faceStack: {
    flex: 1,
  },
  sharedHeadwordLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    transformOrigin: 'left top',
  },
  sharedHeadword: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
