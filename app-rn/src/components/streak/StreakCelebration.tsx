import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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

/** 1막 — 화면을 꽉 채운 꺼진 불이 떨며 힘을 모았다가 터지듯 점화된다. */
const FADE_IN_MS = 260;
const CHARGE_AT_MS = 120;
const CHARGE_MS = 560;
const IGNITE_AT_MS = 720;
const IGNITE_MS = 720;
const FLASH_MS = 560;
const SHAKE_MS = 520;
const RING_MS = 900;
const RING_GAP_MS = 150;
const BURST_MS = 1150;
/** 2막 — 불꽃이 디자인 자리·크기로 날아가 앉는다. */
const TRAVEL_AT_MS = 1950;
const TRAVEL_MS = 640;
const LAND_MS = 560;
/** 3막 — 숫자가 내리꽂히고 N-1 에서 N 으로 넘어간 뒤 문구가 올라온다. */
const COUNT_AT_MS = 2450;
const COUNT_MS = 480;
const COUNT_TICK_AT_MS = 2850;
const COUNT_POP_MS = 420;
const HEADLINE_AT_MS = 3050;
const SUB_AT_MS = 3230;
const COPY_MS = 440;
/** 4막 — 지난 7일 카드가 올라오고 슬롯이 왼쪽부터, 오늘 칸은 한 박자 늦게 크게 점화된다. */
const WEEK_AT_MS = 3650;
const WEEK_MS = 400;
const SLOT_AT_MS = 3800;
const SLOT_STAGGER_MS = 90;
const SLOT_MS = 380;
const TODAY_LAG_MS = 240;
const TODAY_MS = 560;
const CTA_AT_MS = 4900;
const CTA_MS = 480;
const EXIT_MS = 260;

const SETTLE = Easing.out(Easing.cubic);
const SLAM = Easing.out(Easing.back(1.8));
/** 끝에서 목표를 살짝 지나쳤다 돌아오는 비행 곡선. */
const SWOOP = Easing.bezier(0.55, 0, 0.2, 1.12);

const FLAME_SIZE = 168;
const STAGE_SIZE = 236;
const RING_SIZE = 120;
/** 작은 화면에서는 히어로가 CTA 를 밀어내므로 불꽃·숫자를 같은 비율로 줄인다. */
const COMPACT_HEIGHT = 720;
const COMPACT_SCALE = 0.74;
/** 1막 불꽃 높이 상한(화면 대비). 폭은 살짝 넘쳐도 되지만 위아래가 잘리면 불꽃으로 안 읽힌다. */
const BIG_FLAME_WIDTH = 1.25;
const BIG_FLAME_HEIGHT = 0.7;

/** 불꽃 중심에서 튀어 흩어지는 불티. 좌표는 디자인 크기 기준이고 1막 배율만큼 커진다. */
const SPARKS = [
  { dx: -78, dy: -58, size: 7, start: 0 },
  { dx: 66, dy: -74, size: 6, start: 0.04 },
  { dx: -96, dy: 10, size: 5, start: 0.08 },
  { dx: 88, dy: -16, size: 5, start: 0.06 },
  { dx: -52, dy: -92, size: 4, start: 0.12 },
  { dx: 26, dy: -98, size: 5, start: 0.1 },
  { dx: -88, dy: 54, size: 4, start: 0.16 },
  { dx: 80, dy: 48, size: 4, start: 0.14 },
  { dx: 0, dy: -110, size: 3, start: 0.18 },
  { dx: 104, dy: 14, size: 3, start: 0.2 },
  { dx: -112, dy: -30, size: 4, start: 0.22 },
  { dx: 44, dy: 92, size: 3, start: 0.24 },
  { dx: -30, dy: 100, size: 3, start: 0.26 },
  { dx: 116, dy: -50, size: 4, start: 0.28 },
  { dx: -64, dy: -112, size: 3, start: 0.3 },
  { dx: 58, dy: -118, size: 3, start: 0.32 },
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

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const StreakCelebration = React.memo(function StreakCelebration({
  streak,
  headline,
  sub,
  weekDots,
}: StreakCelebrationContent) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const fit = height < COMPACT_HEIGHT ? COMPACT_SCALE : 1;
  const slots = useMemo(() => toDaySlots(weekDots), [weekDots]);

  // 불꽃은 루트 위에 따로 떠 있다가 히어로의 빈 stage 자리로 날아간다 — 그 거리를 레이아웃에서 잰다.
  const [rootBox, setRootBox] = useState<Box | null>(null);
  const [heroBox, setHeroBox] = useState<Box | null>(null);
  const [stageBox, setStageBox] = useState<Box | null>(null);
  const onRootLayout = useCallback((e: LayoutChangeEvent) => setRootBox(e.nativeEvent.layout), []);
  const onHeroLayout = useCallback((e: LayoutChangeEvent) => setHeroBox(e.nativeEvent.layout), []);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => setStageBox(e.nativeEvent.layout), []);

  const geometry = useMemo(() => {
    if (!rootBox || !heroBox || !stageBox) return null;
    const flameSize = FLAME_SIZE * fit;
    const bigFlame = Math.min(rootBox.width * BIG_FLAME_WIDTH, rootBox.height * BIG_FLAME_HEIGHT);
    const zoom = Math.max(1, bigFlame / flameSize);
    // 아이콘 글리프를 transform 으로 키우면 흐려지므로, 크게 그려 두고 제자리에서 줄인다.
    const unit = fit * zoom;
    const actorSize = STAGE_SIZE * unit;
    return {
      unit,
      zoom,
      actorSize,
      left: (rootBox.width - actorSize) / 2,
      top: (rootBox.height - actorSize) / 2,
      dx: heroBox.x + stageBox.x + stageBox.width / 2 - rootBox.width / 2,
      dy: heroBox.y + stageBox.y + stageBox.height / 2 - rootBox.height / 2,
    };
  }, [rootBox, heroBox, stageBox, fit]);

  const enter = useSharedValue(0);
  const exit = useSharedValue(0);
  const charge = useSharedValue(0);
  const ignite = useSharedValue(0);
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const flicker = useSharedValue(0);
  const burst = useSharedValue(0);
  const ring = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const travel = useSharedValue(0);
  const land = useSharedValue(0);
  const countIn = useSharedValue(0);
  const countPop = useSharedValue(0);
  const headlineIn = useSharedValue(0);
  const subIn = useSharedValue(0);
  const weekIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);

  // 점화 직전까지는 어제까지의 숫자를 들고 있다가 숫자가 꽂힌 뒤 넘어간다.
  const [shownStreak, setShownStreak] = useState(() => Math.max(0, streak - 1));
  const ready = geometry !== null;

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setShownStreak(streak), COUNT_TICK_AT_MS);

    enter.value = withTiming(1, { duration: FADE_IN_MS, easing: SETTLE });
    charge.value = withDelay(CHARGE_AT_MS, withTiming(1, { duration: CHARGE_MS, easing: Easing.in(Easing.quad) }));
    ignite.value = withDelay(IGNITE_AT_MS, withTiming(1, { duration: IGNITE_MS, easing: SETTLE }));
    flash.value = withDelay(IGNITE_AT_MS, withTiming(1, { duration: FLASH_MS, easing: Easing.out(Easing.quad) }));
    shake.value = withDelay(IGNITE_AT_MS, withTiming(1, { duration: SHAKE_MS, easing: Easing.linear }));
    ring.value = withDelay(IGNITE_AT_MS, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) }));
    ring2.value = withDelay(IGNITE_AT_MS + RING_GAP_MS, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) }));
    burst.value = withDelay(IGNITE_AT_MS + 40, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
    flicker.value = withDelay(
      IGNITE_AT_MS + IGNITE_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    travel.value = withDelay(TRAVEL_AT_MS, withTiming(1, { duration: TRAVEL_MS, easing: SWOOP }));
    land.value = withDelay(TRAVEL_AT_MS + TRAVEL_MS * 0.8, withTiming(1, { duration: LAND_MS, easing: Easing.out(Easing.cubic) }));
    countIn.value = withDelay(COUNT_AT_MS, withTiming(1, { duration: COUNT_MS, easing: SLAM }));
    countPop.value = withDelay(COUNT_TICK_AT_MS, withTiming(1, { duration: COUNT_POP_MS, easing: SETTLE }));
    headlineIn.value = withDelay(HEADLINE_AT_MS, withTiming(1, { duration: COPY_MS, easing: SETTLE }));
    subIn.value = withDelay(SUB_AT_MS, withTiming(1, { duration: COPY_MS, easing: SETTLE }));
    weekIn.value = withDelay(WEEK_AT_MS, withTiming(1, { duration: WEEK_MS, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: CTA_MS, easing: SLAM }));

    const all = [enter, exit, charge, ignite, flash, shake, flicker, burst, ring, ring2, travel, land, countIn, countPop, headlineIn, subIn, weekIn, ctaIn];
    return () => {
      clearTimeout(timer);
      all.forEach(v => cancelAnimation(v));
    };
  }, [ready, streak, enter, exit, charge, ignite, flash, shake, flicker, burst, ring, ring2, travel, land, countIn, countPop, headlineIn, subIn, weekIn, ctaIn]);

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
    opacity: enter.value * (1 - exit.value),
  }));

  // 감쇠하는 사인파 — 점화 순간 화면 전체가 흔들린다.
  const shakeStyle = useAnimatedStyle(() => {
    const t = shake.value;
    const amp = t >= 1 ? 0 : 14 * (1 - t) * (1 - t);
    return {
      transform: [
        { translateX: Math.sin(t * Math.PI * 11) * amp },
        { translateY: Math.cos(t * Math.PI * 9) * amp * 0.6 },
      ],
    };
  });

  const bgGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 1], [0.2, 1]),
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 0.12, 1], [0, 0.6, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, screenStyle]} onLayout={onRootLayout}>
      <LinearGradient
        colors={[P.bgTop, P.bgMid, P.bgBottom]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, bgGlowStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="streakCelebrationGlow" cx="50%" cy="28%" rx="62%" ry="40%">
              <Stop offset="0" stopColor={P.bgGlow} stopOpacity={0.35} />
              <Stop offset="1" stopColor={P.bgGlow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakCelebrationGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
        <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.hero, { gap: 34 * fit }]} onLayout={onHeroLayout}>
            <View style={{ width: STAGE_SIZE * fit, height: STAGE_SIZE * fit }} onLayout={onStageLayout} />

            <Rise progress={countIn} from={0} scaleFrom={2.4}>
              <CountPop pop={countPop}>
                <View style={styles.countRow}>
                  <Text style={[styles.count, { fontSize: 78 * fit, lineHeight: 84 * fit }]}>{shownStreak}</Text>
                  <Text style={[styles.unit, { fontSize: 26 * fit, lineHeight: 42 * fit }]}>일 연속</Text>
                </View>
              </CountPop>
            </Rise>

            <View style={styles.copy}>
              <Rise progress={headlineIn} from={18}>
                <Text style={styles.headline}>{headline}</Text>
              </Rise>
              <Rise progress={subIn} from={14}>
                <Text style={styles.sub}>{sub}</Text>
              </Rise>
            </View>

            {slots.length > 0 && (
              <Rise progress={weekIn} from={24} style={styles.weekWrap}>
                <View style={styles.weekCard}>
                  {slots.map((slot, i) => (
                    <WeekSlot
                      key={slot.key}
                      slot={slot}
                      delay={SLOT_AT_MS + i * SLOT_STAGGER_MS + (slot.isToday ? TODAY_LAG_MS : 0)}
                    />
                  ))}
                </View>
              </Rise>
            )}
          </View>

          <Rise progress={ctaIn} from={28} scaleFrom={0.9} style={styles.ctaWrap}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={close}
              accessibilityRole="button"
            >
              <Text style={styles.ctaLabel}>이어서 학습하기</Text>
              <Ionicons name="arrow-forward" size={18} color={P.ctaInk} />
            </Pressable>
          </Rise>
        </View>

        {geometry && (
          <FlameActor
            geometry={geometry}
            charge={charge}
            ignite={ignite}
            flicker={flicker}
            burst={burst}
            ring={ring}
            ring2={ring2}
            travel={travel}
            land={land}
          />
        )}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </Animated.View>
  );
});

interface RiseProps {
  progress: SharedValue<number>;
  /** 아래에서 올라오는 거리(px). */
  from: number;
  /** 1 이 아니면 이 배율에서 1 로 수렴한다 — 내리꽂히는 숫자, 튀어 오르는 CTA. */
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const Rise = React.memo(function Rise({ progress, from, scaleFrom = 1, style, children }: RiseProps) {
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [from, 0]) },
      { scale: interpolate(progress.value, [0, 1], [scaleFrom, 1]) },
    ],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

const CountPop = React.memo(function CountPop({ pop, children }: { pop: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pop.value, [0, 0.35, 1], [1, 1.28, 1], Extrapolation.CLAMP) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
});

interface FlameGeometry {
  unit: number;
  zoom: number;
  actorSize: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
}

interface FlameActorProps {
  geometry: FlameGeometry;
  charge: SharedValue<number>;
  ignite: SharedValue<number>;
  flicker: SharedValue<number>;
  burst: SharedValue<number>;
  ring: SharedValue<number>;
  ring2: SharedValue<number>;
  travel: SharedValue<number>;
  land: SharedValue<number>;
}

/** 화면 한가운데 거대하게 점화된 뒤, travel 에 맞춰 stage 자리로 날아가며 1/zoom 로 줄어드는 불꽃. */
const FlameActor = React.memo(function FlameActor({
  geometry,
  charge,
  ignite,
  flicker,
  burst,
  ring,
  ring2,
  travel,
  land,
}: FlameActorProps) {
  const { unit, zoom, actorSize, left, top, dx, dy } = geometry;
  const flameSize = FLAME_SIZE * unit;
  const ringSize = RING_SIZE * unit;

  const actorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: travel.value * dx },
      { translateY: travel.value * dy },
      { scale: interpolate(travel.value, [0, 1], [1, 1 / zoom]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: ignite.value * interpolate(flicker.value, [0, 1], [0.82, 1]),
    transform: [
      {
        scale:
          interpolate(ignite.value, [0, 0.4, 1], [0.3, 1.25, 1], Extrapolation.CLAMP) *
          interpolate(flicker.value, [0, 1], [1, 1.06]) *
          interpolate(land.value, [0, 0.3, 1], [1, 1.3, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  // 힘을 모으며 살짝 움츠러들고 점점 세게 떨린다.
  const dimFlameStyle = useAnimatedStyle(() => {
    const c = charge.value;
    return {
      opacity: interpolate(c, [0, 0.3], [0, 1], Extrapolation.CLAMP) * interpolate(ignite.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: Math.sin(c * Math.PI * 22) * 6 * c * c },
        { scale: interpolate(c, [0, 1], [1, 0.88]) },
      ],
    };
  });

  const litFlameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 0.12], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale:
          interpolate(ignite.value, [0, 0.4, 1], [0.5, 1.2, 1], Extrapolation.CLAMP) *
          interpolate(flicker.value, [0, 1], [1, 1.03]) *
          interpolate(land.value, [0, 0.25, 1], [1, 1.14, 1], Extrapolation.CLAMP),
      },
      { translateY: interpolate(flicker.value, [0, 1], [0, -2 * unit]) },
      { rotate: `${interpolate(flicker.value, [0, 1], [-1.2, 1.2])}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.actor, { left, top, width: actorSize, height: actorSize }, actorStyle]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
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

      <Shockwave progress={ring} size={ringSize} border={2.5 * unit} spread={2.8} />
      <Shockwave progress={ring2} size={ringSize} border={1.5 * unit} spread={3.4} />
      <Shockwave progress={land} size={ringSize} border={2 * unit} spread={1.9} />

      <Animated.View style={[styles.stageCenter, dimFlameStyle]}>
        <Ionicons name="flame" size={flameSize} color={P.flameOff} />
      </Animated.View>

      <Animated.View style={[styles.stageCenter, litFlameStyle]}>
        <View style={[styles.flameBox, { width: flameSize, height: flameSize }]}>
          <Ionicons name="flame" size={flameSize} color={P.flameOuter} />
          <Ionicons
            name="flame"
            size={flameSize * 0.84}
            color={P.flameMid}
            style={[styles.flameLayer, { top: flameSize * 0.2 }]}
          />
          <Ionicons
            name="flame"
            size={flameSize * 0.44}
            color={P.flameCore}
            style={[styles.flameLayer, { top: flameSize * 0.5 }]}
          />
        </View>
      </Animated.View>

      {SPARKS.map((spark, i) => (
        <Spark key={i} burst={burst} unit={unit} {...spark} />
      ))}
    </Animated.View>
  );
});

interface ShockwaveProps {
  progress: SharedValue<number>;
  size: number;
  border: number;
  /** 다 퍼졌을 때의 배율. */
  spread: number;
}

const Shockwave = React.memo(function Shockwave({ progress, size, border, spread }: ShockwaveProps) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 1], [0, 0.75, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.3, spread]) }],
  }));
  return (
    <Animated.View style={[styles.stageCenter, style]}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: border }]} />
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
  unit: number;
}

const Spark = React.memo(function Spark({ burst, dx, dy, size, start, unit }: SparkProps) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(burst.value, [start, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: dx * unit * t },
        // 후반에 중력 대신 부력을 줘 살짝 떠오르게 한다.
        { translateY: (dy * t - 10 * t * t) * unit },
        { scale: interpolate(t, [0, 0.2, 1], [0.4, 1, 0.2], Extrapolation.CLAMP) },
      ],
    };
  });
  const s = size * unit;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spark, { width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }, style]}
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

  const isToday = slot.isToday;

  useEffect(() => {
    pop.value = withDelay(delay, withTiming(1, { duration: isToday ? TODAY_MS : SLOT_MS, easing: SETTLE }));
    return () => cancelAnimation(pop);
  }, [pop, delay, isToday]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pop.value, [0, 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: isToday
          ? interpolate(pop.value, [0, 0.45, 1], [0.2, 1.5, 1], Extrapolation.CLAMP)
          : interpolate(pop.value, [0, 0.6, 1], [0.4, 1.15, 1], Extrapolation.CLAMP),
      },
    ],
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
  },
  actor: {
    position: 'absolute',
  },
  stageCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderColor: P.ring,
  },
  flameBox: {
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
    color: '#FFFFFF',
    textShadowColor: P.countShadow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 22,
  },
  unit: {
    ...Typography.headingBold,
    color: P.unit,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    marginTop: -18,
  },
  weekWrap: {
    alignSelf: 'stretch',
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
  flash: {
    backgroundColor: P.flash,
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
