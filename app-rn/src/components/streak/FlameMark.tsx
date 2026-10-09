import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { EMBERS, FIRE_LOOP_MS, FLAME_LAYERS, lean, lift } from './flame';

/** 불꽃 폭 대비 빛무리 크기. */
const GLOW_RATIO = 1.6;

/**
 * 빛무리 감쇠(끝을 0 에 맞춘 가우시안). stop 사이가 직선이라 성기게 찍으면 기울기가 꺾이는
 * 자리마다 동그란 경계선이 보이므로 촘촘히 샘플링한다.
 */
const GLOW_STOPS = 24;
export const GLOW_FALLOFF: readonly (readonly [number, number])[] = Array.from(
  { length: GLOW_STOPS + 1 },
  (_, i) => {
    const t = i / GLOW_STOPS;
    const floor = Math.exp(-4.5);
    return [t, (Math.exp(-4.5 * t * t) - floor) / (1 - floor)] as const;
  },
);

export type FlameColors = readonly [outer: string, mid: string, core: string];

interface FlameMarkProps {
  size: number;
  /** 3겹 색을 바깥→안 순서로 갈아끼운다. 식은 불꽃처럼 뜻이 다른 상태에 쓴다. */
  colors?: FlameColors;
  /** 뒤에 깔 따뜻한 빛무리. 없으면 그리지 않는다. */
  glow?: string;
  ember?: string;
  /** false 면 너울 없이 멈춘 한 장으로 선다. */
  animated?: boolean;
}

/**
 * 축하 화면과 같은 3겹 불꽃. 점화 연출만 떼고 타오르는 부분만 남겨, 밝은 배경 위에서도
 * 같은 불로 읽히게 한다.
 */
export const FlameMark = React.memo(function FlameMark({
  size,
  colors,
  glow,
  ember,
  animated = true,
}: FlameMarkProps) {
  const fire = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    fire.value = withRepeat(withTiming(1, { duration: FIRE_LOOP_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(fire);
  }, [fire, animated]);

  return (
    <View style={[styles.mark, { width: size, height: size }]} pointerEvents="none">
      {glow && (
        <View style={[styles.glow, { width: size * GLOW_RATIO, height: size * GLOW_RATIO }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="streakMarkGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                {GLOW_FALLOFF.map(([at, a]) => (
                  <Stop key={at} offset={at} stopColor={glow} stopOpacity={0.55 * a} />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakMarkGlow)" />
          </Svg>
        </View>
      )}
      {ember && animated && EMBERS.map((e, i) => (
        <Ember key={i} fire={fire} flameSize={size} color={ember} {...e} />
      ))}
      {FLAME_LAYERS.map((layer, i) => (
        <FlameLayer key={i} fire={fire} flameSize={size} {...layer} color={colors?.[i] ?? layer.color} />
      ))}
    </View>
  );
});

interface IceMarkProps {
  size: number;
  color: string;
  glow?: string;
}

/** 프리즈 상태의 짝 — 불꽃과 같은 자리·같은 빛무리에 눈 결정만 올린다. */
export const IceMark = React.memo(function IceMark({ size, color, glow }: IceMarkProps) {
  return (
    <View style={[styles.mark, { width: size, height: size }]} pointerEvents="none">
      {glow && (
        <View style={[styles.glow, { width: size * GLOW_RATIO, height: size * GLOW_RATIO }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="streakIceGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                {GLOW_FALLOFF.map(([at, a]) => (
                  <Stop key={at} offset={at} stopColor={glow} stopOpacity={0.55 * a} />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakIceGlow)" />
          </Svg>
        </View>
      )}
      <Ionicons name="snow" size={size} color={color} />
    </View>
  );
});

interface FlameLayerProps {
  fire: SharedValue<number>;
  flameSize: number;
  color: string;
  ratio: number;
  top: number;
  stretch: number;
  sway: number;
  lag: number;
}

const FlameLayer = React.memo(function FlameLayer({
  fire,
  flameSize,
  color,
  ratio,
  top,
  stretch,
  sway,
  lag,
}: FlameLayerProps) {
  const style = useAnimatedStyle(() => {
    const up = lift(fire.value, lag);
    return {
      transform: [
        { scaleY: 1 + stretch * up },
        { scaleX: 1 - stretch * 0.4 * up },
        { skewX: `${sway * lean(fire.value, lag)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.layer, { top: flameSize * top }, style]}>
      <Ionicons name="flame" size={flameSize * ratio} color={color} />
    </Animated.View>
  );
});

interface EmberProps {
  fire: SharedValue<number>;
  flameSize: number;
  color: string;
  cycles: number;
  offset: number;
  dx: number;
  size: number;
}

const Ember = React.memo(function Ember({ fire, flameSize, color, cycles, offset, dx, size }: EmberProps) {
  const s = flameSize * size;
  const style = useAnimatedStyle(() => {
    const p = (fire.value * cycles + offset) % 1;
    return {
      opacity: interpolate(p, [0, 0.2, 0.7, 1], [0, 0.75, 0.5, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: flameSize * dx * (1 - p * 0.4) + Math.sin(2 * Math.PI * (p + offset)) * flameSize * 0.025 },
        { translateY: -p * flameSize * 0.85 },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.ember,
        { width: s, height: s, top: flameSize * 0.45, marginLeft: -s / 2, backgroundColor: color },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  layer: {
    position: 'absolute',
    transformOrigin: 'bottom',
  },
  ember: {
    position: 'absolute',
    left: '50%',
    borderRadius: 999,
  },
});
