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

const SPECKS_PER_SPARKLE = 8;
// 멈춘 GlareLayer 빛 띠 중심이 지나는 x/w + y/h 값.
const REST_GLARE_LINE = 0.665;

// 기울이지 않는 썸네일의 멈춘 포일 가루. 글리터 셰이더는 목록 카드마다 띄우기엔 무겁고,
// 큰 십자 별은 스티커처럼 보여서 멈춘 빛 띠에 작은 점만 모은다.
export const StaticSparkles = React.memo(function StaticSparkles({ seed, count, width, height }: {
  seed: string;
  count: number;
  width: number;
  height: number;
}) {
  const specks = React.useMemo(() => {
    const rand = seededRandom(seed);
    return Array.from({ length: count * SPECKS_PER_SPARKLE }, () => {
      const along = rand() * REST_GLARE_LINE;
      // 두 난수 합은 가운데로 몰려서 띠 중심이 가장 촘촘하다.
      const across = (rand() + rand() - 1) * 0.18;
      const bright = rand() < 0.12;
      return {
        x: (along + across) * width,
        y: (REST_GLARE_LINE - along + across) * height,
        size: Math.max(1, width * (bright ? 0.012 : 0.004 + rand() * 0.005)),
        opacity: bright ? 0.95 : 0.3 + rand() * 0.5,
        bright,
      };
    });
  }, [seed, count, width, height]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overflowHidden, styles.specks]}>
      {specks.map((s, i) => (
        <View
          key={i}
          style={[
            styles.speck,
            s.bright && styles.speckBright,
            { left: s.x, top: s.y, width: s.size, height: s.size, borderRadius: s.size, opacity: s.opacity },
          ]}
        />
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
  // overlay 는 바탕이 어두우면 결정면이 묻혀서, 사진 밝기와 상관없이 면이 보이게 결정면 쪽이 섞는 방식을 정한다.
  facet: { position: 'absolute', mixBlendMode: 'hard-light' },
  specks: { mixBlendMode: 'screen' },
  speck: { position: 'absolute', backgroundColor: '#FFFFFF' },
  speckBright: { boxShadow: '0 0 3px 0.5px rgba(255, 255, 255, 0.8)' },
});
