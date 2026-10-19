import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  size?: number;
  color?: string;
}

/** 리스트 행의 chevron 자리를 대신한다. 여러 행이 동시에 돌 수 있다. */
export default function RowSpinner({ size = 18, color = Colors.primary }: Props) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [spinAnim]);
  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Feather name="loader" size={size} color={color} />
    </Animated.View>
  );
}
