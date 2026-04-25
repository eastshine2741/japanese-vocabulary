import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

const FIXED_STEPS = [
  { message: '불러오는 중...', delay: 0 },
  { message: '가사를 찾는 중...', delay: 2000 },
  { message: '뮤직비디오를 칮는 중...', delay: 5000 },
  { message: '가사를 다시 찾는 중...', delay: 10000 },
];

const CYCLING_MESSAGES = [
  '열심히 분석 중...',
  '조금만 기다려주세요',
  '꼼꼼하게 확인 중...',
  '잠시만요...',
];

const CYCLING_START_DELAY = 16000;
const CYCLING_INTERVAL = 5000;

interface Props {
  visible: boolean;
}

export default function AnalyzingOverlay({ visible }: Props) {
  const [shouldRender, setShouldRender] = useState(false);
  const [message, setMessage] = useState(FIXED_STEPS[0].message);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  // Fade in / fade out with card scale
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
          cardScale.setValue(0.9);
        }
      });
    }
  }, [visible, overlayOpacity, cardScale]);

  // Step messages: fixed progression + cycling phase
  useEffect(() => {
    if (!visible) return;

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
  }, [visible, textOpacity]);

  // Spinner rotation
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

  if (!shouldRender) return null;

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="loader" size={32} color={Colors.primary} />
        </Animated.View>
        <Animated.Text style={[styles.label, { opacity: textOpacity }]}>
          {message}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
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
