import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStreakStore, type StreakCelebrationContent } from '../../stores/streakStore';
import { Typography } from '../../theme/typography';
import { toDaySlots, type DaySlot } from './celebrationWeek';
import { CelebrationPalette as P } from './palette';

/** 진입 — 리뷰 화면 위로 아래에서 올라오며 밝아진다. */
const ENTER_MS = 280;
const ENTER_OFFSET_Y = 24;
/** 불 점화 — 꺼져 있던 불이 사라지며 그 자리에 불이 붙는다. */
const IGNITE_DELAY_MS = 120;
const IGNITE_MS = 560;
const BURST_MS = 480;
const RING_MS = 620;
/** 숫자가 N-1 에서 N 으로 넘어가며 한 번 튀는 시점. */
const COUNT_AT_MS = 300;
const COUNT_POP_MS = 320;
const COPY_AT_MS = 420;
const COPY_MS = 300;
/** 주간 슬롯이 왼쪽부터 차례로 올라오고, 오늘 칸이 마지막에 점화된다. */
const SLOT_AT_MS = 520;
const SLOT_STAGGER_MS = 40;
const SLOT_MS = 260;
const CTA_AT_MS = 720;
const CTA_MS = 280;
const EXIT_MS = 220;

const SETTLE = Easing.out(Easing.cubic);

const FLAME_SIZE = 168;
const STAGE_SIZE = 236;

/** 불꽃 중심에서 튀어 흩어지는 불티. start 로 시차를 둬 한꺼번에 터지지 않게 한다. */
const SPARKS = [
  { dx: -78, dy: -58, size: 7, start: 0 },
  { dx: 66, dy: -74, size: 6, start: 0.05 },
  { dx: -96, dy: 10, size: 5, start: 0.1 },
  { dx: 88, dy: -16, size: 5, start: 0.07 },
  { dx: -52, dy: -92, size: 4, start: 0.14 },
  { dx: 26, dy: -98, size: 5, start: 0.11 },
  { dx: -88, dy: 54, size: 4, start: 0.18 },
  { dx: 80, dy: 48, size: 4, start: 0.16 },
  { dx: 0, dy: -110, size: 3, start: 0.2 },
  { dx: 104, dy: 14, size: 3, start: 0.22 },
] as const;

/**
 * 연속 학습 축하 — 오늘 첫 rating 직후 전체 화면으로 올라온다.
 * streakStore.celebration 이 채워지면 나타나고, CTA(또는 뒤로가기)로만 닫힌다.
 */
export const StreakCelebrationHost = React.memo(function StreakCelebrationHost() {
  const celebration = useStreakStore(s => s.celebration);
  if (!celebration) return null;
  // 다시 띄울 때마다 애니메이션이 처음부터 돌도록 새 인스턴스로 마운트한다.
  return <StreakCelebration key={celebration.streak + '/' + celebration.headline} {...celebration} />;
});

function dismiss() {
  useStreakStore.getState().dismissCelebration();
}

const StreakCelebration = React.memo(function StreakCelebration({
  streak,
  headline,
  sub,
  weekDots,
}: StreakCelebrationContent) {
  const insets = useSafeAreaInsets();
  const slots = useMemo(() => toDaySlots(weekDots), [weekDots]);

  const enter = useSharedValue(0);
  const exit = useSharedValue(0);
  const ignite = useSharedValue(0);
  const flicker = useSharedValue(0);
  const burst = useSharedValue(0);
  const ring = useSharedValue(0);
  const countPop = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);

  // 점화 직전까지는 어제까지의 숫자를 들고 있다가 불이 붙을 때 넘어간다.
  const [shownStreak, setShownStreak] = useState(() => Math.max(0, streak - 1));

  useEffect(() => {
    const timer = setTimeout(() => setShownStreak(streak), COUNT_AT_MS);
    return () => clearTimeout(timer);
  }, [streak]);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: SETTLE });
    ignite.value = withDelay(IGNITE_DELAY_MS, withTiming(1, { duration: IGNITE_MS, easing: SETTLE }));
    ring.value = withDelay(IGNITE_DELAY_MS, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) }));
    burst.value = withDelay(IGNITE_DELAY_MS + 60, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
    flicker.value = withDelay(
      IGNITE_DELAY_MS + IGNITE_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    countPop.value = withDelay(COUNT_AT_MS, withTiming(1, { duration: COUNT_POP_MS, easing: SETTLE }));
    copyIn.value = withDelay(COPY_AT_MS, withTiming(1, { duration: COPY_MS, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: CTA_MS, easing: SETTLE }));
    return () => {
      cancelAnimation(enter);
      cancelAnimation(exit);
      cancelAnimation(ignite);
      cancelAnimation(flicker);
      cancelAnimation(burst);
      cancelAnimation(ring);
      cancelAnimation(countPop);
      cancelAnimation(copyIn);
      cancelAnimation(ctaIn);
    };
  }, [enter, exit, ignite, flicker, burst, ring, countPop, copyIn, ctaIn]);

  const close = useCallback(() => {
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) runOnJS(dismiss)();
    });
  }, [exit]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 1], [0, 1]) * (1 - exit.value),
    transform: [{ translateY: interpolate(enter.value, [0, 1], [ENTER_OFFSET_Y, 0]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: ignite.value * interpolate(flicker.value, [0, 1], [0.82, 1]),
    transform: [{ scale: interpolate(ignite.value, [0, 1], [0.4, 1]) * interpolate(flicker.value, [0, 1], [1, 1.06]) }],
  }));

  const dimFlameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));

  // 0.6 에서 1.12 까지 넘겼다가 1.0 으로 가라앉는다.
  const litFlameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(ignite.value, [0, 0.55, 1], [0.6, 1.12, 1], Extrapolation.CLAMP) * interpolate(flicker.value, [0, 1], [1, 1.03]) },
      { translateY: interpolate(flicker.value, [0, 1], [0, -2]) },
      { rotate: `${interpolate(flicker.value, [0, 1], [-1.2, 1.2])}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.12, 1], [0, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.3, 2.2]) }],
  }));

  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(countPop.value, [0, 0.35, 1], [1, 1.2, 1], Extrapolation.CLAMP) }],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyIn.value,
    transform: [{ translateY: interpolate(copyIn.value, [0, 1], [8, 0]) }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: interpolate(ctaIn.value, [0, 1], [12, 0]) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, screenStyle]}>
      <LinearGradient
        colors={[P.bgTop, P.bgMid, P.bgBottom]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="streakCelebrationGlow" cx="50%" cy="28%" rx="62%" ry="40%">
            <Stop offset="0" stopColor={P.bgGlow} stopOpacity={0.35} />
            <Stop offset="1" stopColor={P.bgGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakCelebrationGlow)" />
      </Svg>

      <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.hero}>
          <View style={styles.stage}>
            <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="streakFlameGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor={P.glowCore} stopOpacity={0.75} />
                    <Stop offset="0.45" stopColor={P.glowCore} stopOpacity={0.3} />
                    <Stop offset="1" stopColor={P.glowCore} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakFlameGlow)" />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.stageCenter, ringStyle]} pointerEvents="none">
              <View style={styles.ring} />
            </Animated.View>

            <Animated.View style={[styles.stageCenter, dimFlameStyle]} pointerEvents="none">
              <Ionicons name="flame" size={FLAME_SIZE} color={P.flameOff} />
            </Animated.View>

            <Animated.View style={[styles.stageCenter, litFlameStyle]} pointerEvents="none">
              <View style={styles.flameBox}>
                <Ionicons name="flame" size={FLAME_SIZE} color={P.flameOuter} />
                <Ionicons
                  name="flame"
                  size={FLAME_SIZE * 0.84}
                  color={P.flameMid}
                  style={[styles.flameLayer, { top: FLAME_SIZE * 0.2 }]}
                />
                <Ionicons
                  name="flame"
                  size={FLAME_SIZE * 0.44}
                  color={P.flameCore}
                  style={[styles.flameLayer, { top: FLAME_SIZE * 0.5 }]}
                />
              </View>
            </Animated.View>

            {SPARKS.map((spark, i) => (
              <Spark key={i} burst={burst} {...spark} />
            ))}
          </View>

          <Animated.View style={countStyle}>
            <View style={styles.countRow}>
              <Text style={styles.count}>{shownStreak}</Text>
              <Text style={styles.unit}>일 연속</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.copy, copyStyle]}>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </Animated.View>

          {slots.length > 0 && (
            <View style={styles.weekCard}>
              {slots.map((slot, i) => (
                <WeekSlot key={slot.key} slot={slot} delay={SLOT_AT_MS + i * SLOT_STAGGER_MS} />
              ))}
            </View>
          )}
        </View>

        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={close}
            accessibilityRole="button"
          >
            <Text style={styles.ctaLabel}>이어서 학습하기</Text>
            <Ionicons name="arrow-forward" size={18} color={P.ctaInk} />
          </Pressable>
        </Animated.View>
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

const Spark = React.memo(function Spark({ burst, dx, dy, size, start }: SparkProps) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(burst.value, [start, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: dx * t },
        // 후반에 중력 대신 부력을 줘 살짝 떠오르게 한다.
        { translateY: dy * t - 10 * t * t },
        { scale: interpolate(t, [0, 0.2, 1], [0.4, 1, 0.2], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 },
        style,
      ]}
    />
  );
});

interface WeekSlotProps {
  slot: DaySlot;
  delay: number;
}

/** 학습함(주황 불꽃) / 프리즈(파란 눈송이) / 미학습(빈 원), 오늘은 더 크게 점화된다. */
const WeekSlot = React.memo(function WeekSlot({ slot, delay }: WeekSlotProps) {
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(delay, withTiming(1, { duration: SLOT_MS, easing: SETTLE }));
    return () => cancelAnimation(pop);
  }, [pop, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: interpolate(pop.value, [0, 0.6, 1], [0.6, 1.08, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.slot}>
      <Text style={[styles.slotLabel, slot.isToday && styles.slotLabelToday]}>{slot.label}</Text>
      <Animated.View style={[styles.markBox, style]}>
        {slot.isToday ? (
          <View style={styles.todayShadow}>
            <LinearGradient
              colors={[P.todayTop, P.todayMid, P.todayBottom]}
              locations={[0, 0.4, 1]}
              style={styles.todayMark}
            >
              <Ionicons name="flame" size={21} color="#FFFFFF" />
            </LinearGradient>
          </View>
        ) : slot.status === 'studied' ? (
          <View style={[styles.mark, styles.markStudied]}>
            <Ionicons name="flame" size={15} color={P.studiedInk} />
          </View>
        ) : slot.status === 'freeze' ? (
          <View style={[styles.mark, styles.markFreeze]}>
            <Ionicons name="snow" size={15} color={P.freezeInk} />
          </View>
        ) : (
          <View style={[styles.mark, styles.markNone]} />
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    // 리뷰 화면을 완전히 덮는 테이크오버 — 탭이 뒤로 새지 않게 터치를 전부 받는다.
    zIndex: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: P.ring,
  },
  flameBox: {
    width: FLAME_SIZE,
    height: FLAME_SIZE,
    alignItems: 'center',
  },
  flameLayer: {
    position: 'absolute',
  },
  spark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    backgroundColor: P.spark,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  count: {
    ...Typography.headingExtraBold,
    fontSize: 78,
    lineHeight: 84,
    color: '#FFFFFF',
    textShadowColor: P.countShadow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 22,
  },
  unit: {
    ...Typography.headingBold,
    fontSize: 26,
    lineHeight: 42,
    color: P.unit,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    marginTop: -18,
  },
  headline: {
    ...Typography.headingBold,
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sub: {
    ...Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    color: P.sub,
    textAlign: 'center',
  },
  weekCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: P.cardBg,
    borderWidth: 1,
    borderColor: P.cardBorder,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 9,
  },
  slotLabel: {
    ...Typography.bodySemiBold,
    fontSize: 12.5,
    color: P.slotLabel,
  },
  slotLabelToday: {
    ...Typography.bodyBold,
    fontSize: 12.5,
    color: P.slotLabelToday,
  },
  markBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markStudied: {
    backgroundColor: P.studiedBg,
  },
  markFreeze: {
    backgroundColor: P.freezeBg,
    borderWidth: 1.5,
    borderColor: P.freezeBorder,
  },
  markNone: {
    backgroundColor: P.noneBg,
    borderWidth: 1.5,
    borderColor: P.noneBorder,
  },
  // 그림자는 gradient 바깥 뷰가 든다 — 원형 클립 안에서는 잘린다.
  todayShadow: {
    borderRadius: 19,
    shadowColor: P.todayGlow,
    shadowOpacity: 0.65,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  todayMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: P.todayBorder,
  },
  ctaWrap: {
    paddingTop: 24,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: P.ctaBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: P.ctaGlow,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    ...Typography.bodyBold,
    fontSize: 17,
    color: P.ctaInk,
  },
});
