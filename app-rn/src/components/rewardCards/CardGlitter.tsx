// 웹(개발용) 대체 구현. 앱은 Skia 셰이더인 CardGlitter.native.tsx 를 쓴다.
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { seededRandom } from './seededRandom';
import { CardTilt } from './useCardTilt';

// 진짜 글리터처럼 조각마다 면의 각도가 달라서, 빛 방향이 그 면과 맞을 때만 번쩍인다.
const FACETS = 9;
const GRID = 15;
const GLINTS = 5;
const IDLE_SWAY = 0.32;
const IDLE_PERIOD_MS = 7400;
const FLAKE_TINTS = ['#FFFFFF', '#FFF3CC', '#FFE08A', '#DCEEFF', '#FFD9F3'] as const;

interface Props {
  seed: string;
  width: number;
  height: number;
  tilt: CardTilt;
  /** 0~1. 카드가 낡으면 반짝임도 같이 죽는다. */
  strength: number;
  /** 0~1. 마스터 카드만 무지개 코팅을 얹는다. */
  rainbow?: number;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  tint: number;
}

interface Glint {
  x: number;
  y: number;
  len: number;
  facet: number;
  tint: string;
}

function CardGlitter({ seed, width, height, tilt, strength, rainbow = 0 }: Props) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: IDLE_PERIOD_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(drift);
  }, [drift]);

  const { buckets, glints } = useMemo(() => {
    const rnd = seededRandom(`${seed}-glitter`);
    const cell = width / GRID;
    const scale = width / 240;
    const rows = Math.round(height / cell);
    const groups: Flake[][] = Array.from({ length: FACETS }, () => []);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        if (rnd() < 0.3) continue;
        groups[Math.floor(rnd() * FACETS)].push({
          x: (gx + rnd()) * cell,
          y: (gy + rnd()) * cell,
          r: (1.1 + Math.pow(rnd(), 3) * 2.6) * scale,
          tint: Math.floor(Math.pow(rnd(), 1.6) * FLAKE_TINTS.length),
        });
      }
    }
    const hero: Glint[] = Array.from({ length: GLINTS }, (_, i) => ({
      x: width * (0.12 + rnd() * 0.76),
      y: height * (0.1 + rnd() * 0.8),
      len: width * (0.16 + rnd() * 0.16),
      facet: (i / GLINTS) * Math.PI * 2 + rnd() * 0.5,
      tint: FLAKE_TINTS[1 + Math.floor(rnd() * (FLAKE_TINTS.length - 1))],
    }));
    return { buckets: groups, glints: hero };
  }, [seed, width, height]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.screen]}>
      {rainbow > 0 && <RainbowSheen width={width} height={height} tilt={tilt} strength={rainbow} />}
      {buckets.map((flakes, i) => (
        <FlakeBucket
          key={i}
          id={`${seed}-f${i}`}
          flakes={flakes}
          facet={(i / FACETS) * Math.PI * 2}
          width={width}
          height={height}
          tilt={tilt}
          drift={drift}
          strength={strength}
        />
      ))}
      {glints.map((g, i) => (
        <HeroGlint key={i} id={`${seed}-g${i}`} glint={g} tilt={tilt} drift={drift} strength={strength} />
      ))}
    </View>
  );
}

export default React.memo(CardGlitter);

/** 빛이 이 면에 얼마나 정면으로 맞는지 0~1. 기울이지 않아도 천천히 돌아서 가만히 들고 있어도 반짝인다. */
function facetHit(tilt: CardTilt, drift: SharedValue<number>, facet: number, sharpness: number) {
  'worklet';
  const t = drift.value * Math.PI * 2;
  const vx = tilt.x.value + Math.cos(t) * IDLE_SWAY;
  const vy = tilt.y.value + Math.sin(t * 2) * IDLE_SWAY * 0.6;
  const c = Math.cos(Math.atan2(vy, vx) - facet);
  return c > 0 ? Math.pow(c, sharpness) * Math.min(1, Math.hypot(vx, vy) * 1.6) : 0;
}

const FlakeBucket = React.memo(function FlakeBucket({ id, flakes, facet, width, height, tilt, drift, strength }: {
  id: string;
  flakes: Flake[];
  facet: number;
  width: number;
  height: number;
  tilt: CardTilt;
  drift: SharedValue<number>;
  strength: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: strength * (0.14 + 0.86 * facetHit(tilt, drift, facet, 7)),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Defs>
          {FLAKE_TINTS.map((tint, t) => (
            <RadialGradient key={t} id={`${id}-${t}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.28" stopColor={tint} stopOpacity={0.85} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {flakes.map((f, i) => (
          <Circle key={i} cx={f.x} cy={f.y} r={f.r} fill={`url(#${id}-${f.tint})`} />
        ))}
      </Svg>
    </Animated.View>
  );
});

const RAINBOW = ['#FFFFFF00', '#FFB3C7', '#FFF0A8', '#B8FFD0', '#A8E8FF', '#C9B8FF', '#FFFFFF00'] as const;

/** 무지개 광택 띠. 기울이는 쪽으로 흘러간다. */
const RainbowSheen = React.memo(function RainbowSheen({ width, height, tilt, strength }: {
  width: number;
  height: number;
  tilt: CardTilt;
  strength: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: strength * (0.3 + Math.min(0.35, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 0.35)),
    transform: [
      { translateX: -width + tilt.x.value * width * 0.7 },
      { translateY: -height * 0.5 + tilt.y.value * height * 0.3 },
    ],
  }));
  return (
    <Animated.View style={[{ width: width * 3, height: height * 2 }, style]}>
      <ExpoLinearGradient colors={RAINBOW} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

const HeroGlint = React.memo(function HeroGlint({ id, glint, tilt, drift, strength }: {
  id: string;
  glint: Glint;
  tilt: CardTilt;
  drift: SharedValue<number>;
  strength: number;
}) {
  const L = glint.len;
  const c = L / 2;
  const style = useAnimatedStyle(() => {
    const hit = facetHit(tilt, drift, glint.facet, 22);
    return {
      opacity: strength * hit,
      transform: [
        { scale: 0.35 + hit * 0.75 },
        { rotate: `${tilt.x.value * 14 + drift.value * 30}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.glint, { left: glint.x - c, top: glint.y - c, width: L, height: L }, style]}>
      <Svg width={L} height={L}>
        <Defs>
          <RadialGradient id={`${id}-bloom`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.1" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="0.35" stopColor={glint.tint} stopOpacity={0.35} />
            <Stop offset="1" stopColor={glint.tint} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}-ray`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.42" stopColor={glint.tint} stopOpacity={0.55} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.58" stopColor={glint.tint} stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={L * 0.2} fill={`url(#${id}-bloom)`} />
        <Ellipse cx={c} cy={c} rx={c} ry={Math.max(0.5, L * 0.011)} fill={`url(#${id}-ray)`} />
        <G rotation={90} origin={`${c}, ${c}`}>
          <Ellipse cx={c} cy={c} rx={c * 0.82} ry={Math.max(0.5, L * 0.011)} fill={`url(#${id}-ray)`} />
        </G>
        <G rotation={45} origin={`${c}, ${c}`} opacity={0.45}>
          <Ellipse cx={c} cy={c} rx={c * 0.38} ry={Math.max(0.4, L * 0.007)} fill={`url(#${id}-ray)`} />
        </G>
        <G rotation={-45} origin={`${c}, ${c}`} opacity={0.45}>
          <Ellipse cx={c} cy={c} rx={c * 0.38} ry={Math.max(0.4, L * 0.007)} fill={`url(#${id}-ray)`} />
        </G>
        <Circle cx={c} cy={c} r={Math.max(0.8, L * 0.022)} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  screen: { overflow: 'hidden', mixBlendMode: 'screen' },
  glint: { position: 'absolute' },
});
