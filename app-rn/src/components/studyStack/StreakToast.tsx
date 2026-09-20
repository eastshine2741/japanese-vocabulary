import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStreakStore } from '../../stores/streakStore';
import { Typography } from '../../theme/typography';

const ENTER_MS = 220;
const HOLD_MS = 2400;
const EXIT_MS = 200;
const ENTER_OFFSET_Y = -8;

/**
 * A-1 완료 배너 — 오늘 첫 rating 직후 몰입 크롬 진행바 아래에 떠올라 스스로 사라진다.
 * streakStore.toast 가 채워지면 나타나고, 퇴장이 끝나면 비운다. 탭 동작 없음.
 */
export const StreakToastHost = React.memo(function StreakToastHost() {
  const toast = useStreakStore(s => s.toast);
  if (!toast) return null;
  return <StreakToast eyebrow={toast.eyebrow} label={toast.label} />;
});

interface StreakToastProps {
  eyebrow: string;
  label: string;
}

const StreakToast = React.memo(function StreakToast({ eyebrow, label }: StreakToastProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(progress, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) useStreakStore.getState().dismissToast();
    });
    return () => anim.stop();
  }, [progress]);

  const motion = {
    opacity: progress,
    transform: [{
      translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_OFFSET_Y, 0] }),
    }],
  };

  return (
    <Animated.View style={[styles.wrap, motion]} pointerEvents="none">
      <View style={styles.shadow}>
        <LinearGradient
          colors={['#FF5A1F', '#FF9500', '#FFB300']}
          locations={[0, 0.62, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <View style={styles.glow} />
          <Ionicons name="flame" size={112} color="rgba(255,255,255,0.14)" style={styles.bgFlame} />
          <View style={[styles.spark, styles.spark1]} />
          <View style={[styles.spark, styles.spark2]} />
          <View style={[styles.spark, styles.spark3]} />
          <View style={[styles.spark, styles.spark4]} />
          <View style={styles.textCol}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // overflow:hidden 인 배너에는 그림자가 잘리므로 바깥 뷰가 든다.
  shadow: {
    borderRadius: 20,
    shadowColor: '#FF7A00',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 10,
  },
  banner: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 18,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: -30,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,224,138,0.28)',
  },
  bgFlame: {
    position: 'absolute',
    right: -28,
    top: -22,
    transform: [{ rotate: '14deg' }],
  },
  spark: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
  spark1: { right: 118, top: 12, width: 6, height: 6 },
  spark2: { right: 102, top: 50, width: 4, height: 4, backgroundColor: '#FFF3C4' },
  spark3: { right: 128, top: 36, width: 3, height: 3 },
  spark4: { right: 18, top: 12, width: 5, height: 5, backgroundColor: '#FFF3C4' },
  textCol: {
    gap: 3,
  },
  eyebrow: {
    ...Typography.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.2,
    color: 'rgba(255,244,214,0.88)',
  },
  label: {
    ...Typography.headingBold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textShadowColor: 'rgba(180,64,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
