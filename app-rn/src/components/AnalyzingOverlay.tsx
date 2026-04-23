import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

const STEPS = [
  '불러오는 중...',
  '가사를 찾는 중...',
  '거의 다 됐어요!',
];

const STEP_DELAYS = [0, 2000, 5000];

interface Props {
  visible: boolean;
}

export default function AnalyzingOverlay({ visible }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const rotation = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      return;
    }

    const timers = STEP_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => {
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setStepIndex(i + 1);
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        });
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [visible, textOpacity]);

  useEffect(() => {
    if (!visible) return;

    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [visible, rotation]);

  if (!visible) return null;

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="loader" size={32} color={Colors.primary} />
        </Animated.View>
        <Animated.Text style={[styles.label, { opacity: textOpacity }]}>
          {STEPS[stepIndex]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
