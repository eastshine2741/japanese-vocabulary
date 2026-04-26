import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Easing, View, Text } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

const FIXED_STEPS = [
  { message: '불러오는 중...', delay: 0 },
  { message: '가사를 찾는 중...', delay: 2000 },
  { message: '뮤직비디오를 찾는 중...', delay: 5000 },
  { message: '가사를 다시 찾는 중...', delay: 10000 },
];

const CYCLING_MESSAGES = [
  '열심히 분석 중...',
  '조금만 기다려주세요',
  '꼼꼼하게 확인 중...',
];

const CYCLING_START_DELAY = 16000;
const CYCLING_INTERVAL = 5000;

const RIPPLE_DURATION = 1800;
const RIPPLE_STAGGER = 600;

interface Props {
  slot?: React.ReactNode;
}

export default function AnalyzingView({ slot }: Props) {
  const [message, setMessage] = useState(FIXED_STEPS[0].message);
  const textOpacity = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const corePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setMessage(FIXED_STEPS[0].message);
    textOpacity.setValue(1);

    const animateTransition = (newMsg: string) => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setMessage(newMsg);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    };

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | null = null;

    for (let i = 1; i < FIXED_STEPS.length; i++) {
      timeouts.push(
        setTimeout(() => animateTransition(FIXED_STEPS[i].message), FIXED_STEPS[i].delay),
      );
    }

    let cycleIndex = 0;
    timeouts.push(
      setTimeout(() => {
        animateTransition(CYCLING_MESSAGES[0]);
        cycleIndex = 1;
        interval = setInterval(() => {
          animateTransition(CYCLING_MESSAGES[cycleIndex % CYCLING_MESSAGES.length]);
          cycleIndex++;
        }, CYCLING_INTERVAL);
      }, CYCLING_START_DELAY),
    );

    return () => {
      timeouts.forEach(clearTimeout);
      if (interval) clearInterval(interval);
    };
  }, [textOpacity]);

  useEffect(() => {
    const ripples = [ripple1, ripple2, ripple3];
    const loops = ripples.map((anim) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: RIPPLE_DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    const timers: ReturnType<typeof setTimeout>[] = [];
    ripples.forEach((_, i) => {
      if (i === 0) {
        loops[0].start();
      } else {
        timers.push(setTimeout(() => loops[i].start(), i * RIPPLE_STAGGER));
      }
    });
    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
      ripples.forEach((a) => a.setValue(0));
    };
  }, [ripple1, ripple2, ripple3]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [corePulse]);

  const rippleTransform = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1.4],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.32, 0],
    }),
  });

  const coreScale = corePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View style={styles.container}>
      {slot}
      <Animated.View style={[styles.hero]}>
        <Animated.View style={[styles.ring, rippleTransform(ripple3)]} />
        <Animated.View style={[styles.ring, rippleTransform(ripple2)]} />
        <Animated.View style={[styles.ring, rippleTransform(ripple1)]} />
        <Animated.View style={[styles.heroCore, { transform: [{ scale: coreScale }] }]}>
          <MaterialCommunityIcons name="music" size={32} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
      <View style={styles.msgBlock}>
        <Animated.Text style={[styles.msgTitle, { opacity: textOpacity }]}>
          {message}
        </Animated.Text>
        <Animated.Text style={styles.msgSub}>
          꼼꼼하게 확인하고 있으니 조금만 기다려주세요
        </Animated.Text>
      </View>
      <View style={styles.hint}>
        <Feather name="clock" size={14} color={Colors.textMuted} />
        <Text style={styles.hintText}>보통 15~20초 정도 걸려요</Text>
      </View>
    </View>
  );
}

const RING_COLOR = Colors.primary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 0,
  },
  hero: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: RING_COLOR,
  },
  heroCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  msgTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  msgSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
