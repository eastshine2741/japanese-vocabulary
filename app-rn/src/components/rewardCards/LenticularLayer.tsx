import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import LenticularScene, { LenticularProps } from './LenticularScene';
import { CardTilt } from './useCardTilt';

// 웹(개발용)은 Skia 없이 장면을 띠로 잘라 흉내만 낸다. 앱은 LenticularLayer.native.tsx.
const STRIPS = 22;

export default function LenticularLayer({ tilt, ...scene }: LenticularProps & { tilt: CardTilt }) {
  const stripW = scene.width / STRIPS;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: STRIPS }, (_, i) => (
        <Strip key={i} index={i} stripW={stripW} height={scene.height} x={tilt.x}>
          <LenticularScene {...scene} />
        </Strip>
      ))}
    </View>
  );
}

const Strip = React.memo(function Strip({ index, stripW, height, x, children }: {
  index: number;
  stripW: number;
  height: number;
  x: SharedValue<number>;
  children: React.ReactNode;
}) {
  const start = 0.05 + (index / STRIPS) * 0.3;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [start, start + 0.16], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View style={[styles.strip, { left: index * stripW, width: Math.ceil(stripW), height }, style]}>
      <View style={{ position: 'absolute', left: -index * stripW }}>{children}</View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  strip: { position: 'absolute', top: 0, overflow: 'hidden' },
});
