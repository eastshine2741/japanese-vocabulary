import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SpreadLayerProps, spreadReach } from './spreadLayer';

// 웹(개발용)은 Skia 없이 번진 만큼 새 카드를 겹쳐 비추기만 한다. 앱은 CardSpreadLayer.native.tsx.
export default function CardSpreadLayer({ width, height, before, after, focus, spread, onReady }: SpreadLayerProps) {
  useEffect(onReady, [onReady]);
  const reach = spreadReach(width, height, focus);
  const afterStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, spread.value / reach) }));
  return (
    <View style={{ width, height }}>
      <View style={StyleSheet.absoluteFill}>{before}</View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, afterStyle]}>
        {after}
      </Animated.View>
    </View>
  );
}
