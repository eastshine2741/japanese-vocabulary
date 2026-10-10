import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { HOLO_COLORS } from './cardTheme';
import { seededRandom } from './seededRandom';
import { CardTilt } from './useCardTilt';

export function HoloLayer({ tilt, width, height, opacity, blend }: {
  tilt?: CardTilt;
  width: number;
  height: number;
  opacity: number;
  blend: 'overlay' | 'color-dodge';
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width + (tilt?.x.value ?? -0.2) * width * 0.8 },
      { translateY: -height * 0.5 + (tilt?.y.value ?? 0) * height * 0.35 },
    ],
  }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overflowHidden, { opacity, mixBlendMode: blend }]}>
      <Animated.View style={[{ width: width * 3, height: height * 2 }, style]}>
        <LinearGradient colors={HOLO_COLORS} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const ETCH = require('../../../assets/cards/holo-etch.png');

/** 포일에 새긴 사선 결과 알갱이. 빛을 받는 각도에서만 떠오른다. tilt 가 없으면 GlareLayer 처럼 비스듬한 빛에 멈춰 있다. */
export function EtchLayer({ tilt, width, height, opacity }: { tilt?: CardTilt; width: number; height: number; opacity: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity * (0.12 + Math.min(0.88, (Math.abs(tilt?.x.value ?? -0.35) + Math.abs(tilt?.y.value ?? -0.25)) * 1.3)),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.etch, style]}>
      <Image source={ETCH} resizeMode="stretch" style={{ width, height }} />
    </Animated.View>
  );
}

const FACET_A = require('../../../assets/cards/facet-a.png');
const FACET_B = require('../../../assets/cards/facet-b.png');

/** 다이아 결정면. 면마다 밝기가 다른 두 장을 기울기에 따라 엇갈려 섞어, 기울이면 면들이 번갈아 빛을 받는다. */
export function FacetLayer({ tilt, width, height, opacity }: { tilt?: CardTilt; width: number; height: number; opacity: number }) {
  const aStyle = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, 0.5 + (tilt?.x.value ?? -0.2) * 1.6 + (tilt?.y.value ?? 0) * 0.9));
    return { opacity: opacity * k };
  });
  const bStyle = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, 0.5 + (tilt?.x.value ?? -0.2) * 1.6 + (tilt?.y.value ?? 0) * 0.9));
    return { opacity: opacity * (1 - k) };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image source={FACET_A} resizeMode="stretch" style={[styles.facet, { width, height }, aStyle]} />
      <Animated.Image source={FACET_B} resizeMode="stretch" style={[styles.facet, { width, height }, bStyle]} />
    </View>
  );
}

/** 썸네일처럼 기울이지 않는 카드에 멈춘 반짝임 몇 점. 글리터 셰이더를 목록 카드마다 띄우면 무겁다. */
export const StaticSparkles = React.memo(function StaticSparkles({ seed, count, width, height }: {
  seed: string;
  count: number;
  width: number;
  height: number;
}) {
  const sparkles = React.useMemo(() => {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, () => ({
      x: rand() * width,
      y: rand() * height * 0.75,
      size: width * (0.025 + rand() * 0.04),
    }));
  }, [seed, count, width, height]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparkles.map((s, i) => (
        <View key={i} style={[styles.sparkle, { left: s.x - s.size / 2, top: s.y - s.size / 2, width: s.size, height: s.size }]}>
          <View style={[styles.sparkleRay, { width: s.size, height: s.size * 0.09, borderRadius: s.size }]} />
          <View style={[styles.sparkleRay, { width: s.size * 0.09, height: s.size, borderRadius: s.size }]} />
          <View style={[styles.sparkleCore, { width: s.size * 0.22, height: s.size * 0.22, borderRadius: s.size }]} />
        </View>
      ))}
    </View>
  );
});

/** tilt 가 없으면 빛이 왼쪽 위에서 비스듬히 비친 자리에 멈춰 있다. */
export function GlareLayer({ tilt, width, height, gloss }: { tilt?: CardTilt; width: number; height: number; gloss: number }) {
  const style = useAnimatedStyle(() => {
    const tx = tilt?.x.value ?? -0.35;
    const ty = tilt?.y.value ?? -0.25;
    return {
      opacity: gloss * (0.35 + Math.min(0.4, (Math.abs(tx) + Math.abs(ty)) * 0.3)),
      transform: [
        { translateX: -width * 0.75 + tx * width * 0.6 },
        { translateY: -height * 0.75 + ty * height * 0.5 },
      ],
    };
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overflowHidden]}>
      <Animated.View style={[{ width: width * 2.5, height: height * 2.5 }, style]}>
        <LinearGradient
          colors={['#FFFFFF00', '#FFFFFF00', '#FFFFFF55', '#FFFFFF00', '#00000033']}
          locations={[0, 0.38, 0.5, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overflowHidden: { overflow: 'hidden' },
  etch: { mixBlendMode: 'color-dodge' },
  facet: { position: 'absolute', mixBlendMode: 'overlay' },
  sparkle: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sparkleRay: { position: 'absolute', backgroundColor: '#FFFFFFE6' },
  sparkleCore: { backgroundColor: '#FFFFFF', boxShadow: '0 0 4px 1px rgba(255, 255, 255, 0.9)' },
});
