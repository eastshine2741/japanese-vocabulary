import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { HOLO_COLORS } from './cardTheme';
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

/** 포일에 새긴 사선 결과 알갱이. 빛을 받는 각도에서만 떠오른다. */
export function EtchLayer({ tilt, width, height, opacity }: { tilt: CardTilt; width: number; height: number; opacity: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity * (0.12 + Math.min(0.88, (Math.abs(tilt.x.value) + Math.abs(tilt.y.value)) * 1.3)),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.etch, style]}>
      <Image source={ETCH} resizeMode="stretch" style={{ width, height }} />
    </Animated.View>
  );
}

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
});
