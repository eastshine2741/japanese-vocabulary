import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, Circle, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { SpreadLayerProps, spreadReach } from './spreadLayer';

/** 앞장선 물결 뒤로 따라오는 잔물결 — reach 대비 간격. */
const ECHO_GAP = 0.11;

/**
 * 옛 카드 위에 focus 를 중심으로 둥글게 잘린 창을 열어 새 카드를 드러낸다.
 * 뷰를 이미지로 뜨면 늦게 오는 사진이 빠지고 mixBlendMode 가 무시돼, 실제 뷰를 그대로 잘라 보인다.
 */
export default function CardSpreadLayer({ width, height, before, after, focus, spread, spot, shock, stampR, onReady }: SpreadLayerProps) {
  const reach = spreadReach(width, height, focus);
  useEffect(onReady, [onReady]);

  const windowStyle = useAnimatedStyle(() => {
    const r = spread.value;
    return { left: focus.x - r, top: focus.y - r, width: r * 2, height: r * 2, borderRadius: r };
  });
  // 창이 움직여도 새 카드는 제자리에 있게 거꾸로 민다.
  const afterStyle = useAnimatedStyle(() => {
    const r = spread.value;
    return { left: r - focus.x, top: r - focus.y };
  });

  // 다 덮으면(p=1) 물결·광택은 모두 0 이 되어 정적인 새 카드만 남는다.
  const p = useDerivedValue(() => Math.min(1, spread.value / reach));
  const waving = useDerivedValue(() => (spread.value > 0 && p.value < 1 ? 1 : 0));
  // 막 박힌 작은 자국엔 가는 테만 — 굵기는 원이 커질수록 따라 붙는다.
  const edgeOpacity = useDerivedValue(() => waving.value * (0.5 + 0.5 * (1 - p.value)));
  const edgeWidth = useDerivedValue(() => Math.min(1 + 4 * (1 - p.value), spread.value * 0.08));
  const glowWidth = useDerivedValue(() => Math.min(12, spread.value * 0.25));
  const glowOpacity = useDerivedValue(() => waving.value * 0.5 * (1 - p.value));
  const sheenR = useDerivedValue(() => Math.max(0, spread.value - reach * 0.07));
  // 새 카드와 섞지 않고 위에 얹으므로 softLight 때보다 옅게.
  const sheenOpacity = useDerivedValue(() => waving.value * 0.25 * (1 - p.value * p.value));
  const echo1R = useDerivedValue(() => Math.max(0, spread.value - reach * ECHO_GAP));
  const echo2R = useDerivedValue(() => Math.max(0, spread.value - reach * ECHO_GAP * 2));
  const echo1Opacity = useDerivedValue(() => (echo1R.value > 0 ? waving.value * 0.45 * (1 - p.value) : 0));
  const echo2Opacity = useDerivedValue(() => (echo2R.value > 0 ? waving.value * 0.25 * (1 - p.value) : 0));

  const shockR = useDerivedValue(() => stampR + shock.value * width * 0.7);
  const shockOpacity = useDerivedValue(() => (shock.value > 0 && shock.value < 1 ? 0.95 * (1 - shock.value) : 0));
  const shockWidth = useDerivedValue(() => 0.8 + 2.5 * (1 - shock.value));
  // 두 번째 충격파는 조금 늦게, 덜 멀리 — 한 번 내리친 게 두 겹으로 울린다.
  const shock2 = useDerivedValue(() => Math.max(0, (shock.value - 0.12) / 0.88));
  const shock2R = useDerivedValue(() => stampR + shock2.value * width * 0.45);
  const shock2Opacity = useDerivedValue(() => (shock2.value > 0 && shock2.value < 1 ? 0.6 * (1 - shock2.value) : 0));
  const flareOpacity = useDerivedValue(() => (shock.value > 0 ? 0.9 * (1 - shock.value) ** 2 : 0));

  // 구멍 밖은 가장 진한 색으로 고정된다(clamp) — 카드 끝까지 어둡다.
  const spotR = width * 0.6;
  const hole = Math.min(0.9, (stampR * 1.8) / spotR);

  return (
    <View style={{ width, height }}>
      <View style={StyleSheet.absoluteFill}>{before}</View>
      <Animated.View pointerEvents="none" style={[styles.window, windowStyle]}>
        <Animated.View style={[styles.after, { width, height }, afterStyle]}>{after}</Animated.View>
      </Animated.View>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Circle cx={focus.x} cy={focus.y} r={sheenR} style="stroke" strokeWidth={reach * 0.14} color="white" opacity={sheenOpacity}>
          <BlurMask blur={14} style="normal" />
        </Circle>
        <Circle cx={focus.x} cy={focus.y} r={echo2R} style="stroke" strokeWidth={1.5} color="white" opacity={echo2Opacity} />
        <Circle cx={focus.x} cy={focus.y} r={echo1R} style="stroke" strokeWidth={1.5} color="white" opacity={echo1Opacity} />
        <Circle cx={focus.x} cy={focus.y} r={spread} style="stroke" strokeWidth={glowWidth} color="white" opacity={glowOpacity}>
          <BlurMask blur={10} style="normal" />
        </Circle>
        <Circle cx={focus.x} cy={focus.y} r={spread} style="stroke" strokeWidth={edgeWidth} color="white" opacity={edgeOpacity}>
          <BlurMask blur={3} style="solid" />
        </Circle>
        <Rect x={0} y={0} width={width} height={height} opacity={spot}>
          <RadialGradient
            c={vec(focus.x, focus.y)}
            r={spotR}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            positions={[0, hole, 1]}
          />
        </Rect>
        <Circle cx={focus.x} cy={focus.y} r={stampR * 1.6} color="white" opacity={flareOpacity}>
          <BlurMask blur={8} style="normal" />
        </Circle>
        <Circle cx={focus.x} cy={focus.y} r={shockR} style="stroke" strokeWidth={shockWidth} color="white" opacity={shockOpacity}>
          <BlurMask blur={1.5} style="solid" />
        </Circle>
        <Circle cx={focus.x} cy={focus.y} r={shock2R} style="stroke" strokeWidth={0.8} color="white" opacity={shock2Opacity} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { position: 'absolute', overflow: 'hidden' },
  after: { position: 'absolute' },
});
