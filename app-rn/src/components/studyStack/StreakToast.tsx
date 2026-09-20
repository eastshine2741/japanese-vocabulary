import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStreakStore } from '../../stores/streakStore';
import { Typography } from '../../theme/typography';

const FADE_MS = 200;
const HOLD_MS = 2600;
const EXIT_MS = 220;
const ENTER_OFFSET_Y = -16;
/** 화면 위 끝(safe area 아래)에서 배너까지의 여백. */
const TOP_MARGIN = 8;
/** 배너가 자리잡은 뒤 불꽃이 켜지고, 그 직후 불티가 튀고, 빛줄기가 훑고 지나간다. */
const FLAME_DELAY_MS = 90;
const BURST_DELAY_MS = 150;
const BURST_MS = 760;
const RING_MS = 640;
const SHIMMER_DELAY_MS = 260;
const SHIMMER_MS = 720;
const EYEBROW_DELAY_MS = 110;
const LABEL_DELAY_MS = 190;
/** 등장이 다 끝난 뒤에 hold 를 재기 시작하도록 여유를 둔다. */
const ENTER_SETTLE_MS = 420;

// 한 번 움직이고 멈춘다 — 오버슈트 없는 ease-out 만 쓴다.
const ENTER_MS = 320;
const FLAME_IN_MS = 260;
const TEXT_IN_MS = 300;
const SETTLE = Easing.out(Easing.cubic);

/** 앞불꽃 중심을 기준으로 한 불티 궤적. 순서대로 조금씩 늦게 튀어 한꺼번에 터지는 느낌을 피한다. */
const SPARKS = [
  { dx: -44, dy: -34, size: 6, start: 0 },
  { dx: 30, dy: -46, size: 5, start: 0.04 },
  { dx: -58, dy: 6, size: 4, start: 0.08 },
  { dx: 44, dy: -14, size: 4, start: 0.06 },
  { dx: -30, dy: -54, size: 3, start: 0.12 },
  { dx: 12, dy: -60, size: 4, start: 0.1 },
  { dx: -50, dy: -18, size: 3, start: 0.16 },
  { dx: 38, dy: 20, size: 3, start: 0.14 },
] as const;

const FLAME_SIZE = 44;
const FLAME_RIGHT = 22;
const RING_SIZE = 56;

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

function dismissToast() {
  useStreakStore.getState().dismissToast();
}

/**
 * 등장: 배너가 튀어오르듯 자리잡고 → 앞불꽃이 켜지며 파문이 퍼지고 불티가 튀고 → 빛줄기가 훑고 지나간다.
 * 떠 있는 동안 불꽃은 계속 일렁이고 뒤의 빛무리가 숨쉰다. 퇴장은 짧게 위로 사라진다.
 */
const StreakToast = React.memo(function StreakToast({ eyebrow, label }: StreakToastProps) {
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  const enter = useSharedValue(0);
  const exit = useSharedValue(0);
  const flame = useSharedValue(0);
  const flicker = useSharedValue(0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const breath = useSharedValue(0);
  const eyebrowIn = useSharedValue(0);
  const labelIn = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    enter.value = withTiming(1, { duration: ENTER_MS, easing: SETTLE });
    flame.value = withDelay(FLAME_DELAY_MS, withTiming(1, { duration: FLAME_IN_MS, easing: SETTLE }));
    flicker.value = withDelay(
      FLAME_DELAY_MS + 300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 440, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    ring.value = withDelay(FLAME_DELAY_MS + 40, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) }));
    burst.value = withDelay(BURST_DELAY_MS, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
    shimmer.value = withDelay(SHIMMER_DELAY_MS, withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.cubic) }));
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    eyebrowIn.value = withDelay(EYEBROW_DELAY_MS, withTiming(1, { duration: TEXT_IN_MS, easing: SETTLE }));
    labelIn.value = withDelay(LABEL_DELAY_MS, withTiming(1, { duration: TEXT_IN_MS, easing: SETTLE }));
    exit.value = withDelay(
      ENTER_SETTLE_MS + HOLD_MS,
      withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, finished => {
        if (finished) runOnJS(dismissToast)();
      }),
    );
    return () => {
      cancelAnimation(fade);
      cancelAnimation(enter);
      cancelAnimation(exit);
      cancelAnimation(flame);
      cancelAnimation(flicker);
      cancelAnimation(ring);
      cancelAnimation(burst);
      cancelAnimation(shimmer);
      cancelAnimation(breath);
      cancelAnimation(eyebrowIn);
      cancelAnimation(labelIn);
    };
  }, [fade, enter, exit, flame, flicker, ring, burst, shimmer, breath, eyebrowIn, labelIn]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (1 - exit.value),
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [ENTER_OFFSET_Y, 0]) - 10 * exit.value },
      { scale: interpolate(enter.value, [0, 1], [0.9, 1]) - 0.04 * exit.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.24, 0.42]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.14]) }],
  }));

  const flameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flame.value, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(flicker.value, [0, 1], [0, -1]) },
      { scale: flame.value * interpolate(flicker.value, [0, 1], [1, 1.04]) },
      { rotate: `${interpolate(flicker.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.85, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.4, 2.6]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-160, 560]) },
      { rotate: '18deg' },
    ],
  }));

  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(eyebrowIn.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(eyebrowIn.value, [0, 1], [8, 0]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(labelIn.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(labelIn.value, [0, 1], [12, 0]) },
      { scale: interpolate(labelIn.value, [0, 1], [0.92, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + TOP_MARGIN }, bannerStyle]} pointerEvents="none">
      <View style={styles.shadow}>
        <LinearGradient
          colors={['#FF5A1F', '#FF9500', '#FFB300']}
          locations={[0, 0.62, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <Animated.View style={[styles.glow, glowStyle]} />
          <Ionicons name="flame" size={112} color="rgba(255,255,255,0.12)" style={styles.bgFlame} />
          <View style={[styles.spark, styles.spark1]} />
          <View style={[styles.spark, styles.spark2]} />
          <View style={[styles.spark, styles.spark3]} />

          <Animated.View style={[styles.shimmer, shimmerStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.textCol}>
            <Animated.Text style={[styles.eyebrow, eyebrowStyle]}>{eyebrow}</Animated.Text>
            <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
          </View>

          <View style={styles.flameStage} pointerEvents="none">
            <Animated.View style={[styles.ring, ringStyle]} />
            {SPARKS.map((spark, i) => (
              <Spark key={i} burst={burst} {...spark} />
            ))}
            <Animated.View style={flameStyle}>
              <Ionicons name="flame" size={FLAME_SIZE} color="#FFFFFF" style={styles.flame} />
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
});

interface SparkProps {
  burst: SharedValue<number>;
  dx: number;
  dy: number;
  size: number;
  /** burst 진행도(0~1) 중 이 불티가 출발하는 지점. */
  start: number;
}

/** 앞불꽃 중심에서 튀어나가 흩어지며 사라지는 불티 하나. burst 하나를 나눠 쓰고 start 로 시차를 둔다. */
const Spark = React.memo(function Spark({ burst, dx, dy, size, start }: SparkProps) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(burst.value, [start, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: dx * t },
        // 살짝 위로 뜨는 느낌: 후반에 중력 대신 부력을 준다.
        { translateY: dy * t - 6 * t * t },
        { scale: interpolate(t, [0, 0.2, 1], [0.4, 1, 0.2], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.sparkParticle,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  // 앱바 아래 흐름이 아니라 화면 위 끝 기준으로 띄운다.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
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
    backgroundColor: 'rgb(255,224,138)',
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
  spark1: { right: 118, top: 12, width: 5, height: 5 },
  spark2: { right: 104, top: 52, width: 4, height: 4, backgroundColor: '#FFF3C4' },
  spark3: { right: 132, top: 34, width: 3, height: 3 },
  shimmer: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    left: 0,
    width: 90,
  },
  textCol: {
    gap: 3,
    paddingRight: FLAME_RIGHT + FLAME_SIZE + 12,
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
  // 앞불꽃·파문·불티가 같은 중심을 공유하는 무대. 텍스트 높이에 맞춰 세로 중앙에 둔다.
  flameStage: {
    position: 'absolute',
    right: FLAME_RIGHT,
    top: 0,
    bottom: 0,
    width: FLAME_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  sparkParticle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    backgroundColor: '#FFF3C4',
  },
  flame: {
    textShadowColor: 'rgba(255,240,150,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
});
