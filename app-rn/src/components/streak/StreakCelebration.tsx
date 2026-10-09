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
import { EMBERS, FIRE_LOOP_MS, FLAME_LAYERS, lean, lift } from './flame';

/** 1막 — 화면을 꽉 채운 꺼진 불이 떨며 힘을 모았다가, 밑동부터 불이 옮겨붙어 확 타오른다. */
const FADE_IN_MS = 260;
const CHARGE_AT_MS = 120;
const CHARGE_MS = 560;
const IGNITE_AT_MS = 720;
const IGNITE_MS = 700;
/** 불이 옮겨붙고 한 박자 뒤 확 치솟는 순간. 섬광·불티·울림이 여기에 몰린다. */
const WHOOSH_AT_MS = IGNITE_AT_MS + 220;
const FLARE_UP_MS = 180;
const FLARE_DOWN_MS = 850;
const SHAKE_MS = 450;
const BURST_MS = 1300;
/** 2막 — 불꽃이 디자인 자리·크기로 날아가 앉는다. */
const TRAVEL_AT_MS = 1950;
const TRAVEL_MS = 640;
const LAND_MS = 560;
/** 3막 — 어제까지의 N-1 이 조용히 떠오른 뒤, N 이 크게 내리꽂히며 자리를 뺏고 문구가 올라온다. */
const COUNT_AT_MS = 2450;
const COUNT_MS = 420;
const COUNT_SLAM_AT_MS = 3000;
const COUNT_SLAM_MS = 500;
const HEADLINE_AT_MS = 3400;
const SUB_AT_MS = 3580;
const COPY_MS = 440;
/** 4막 — 지난 7일 카드가 올라오고 슬롯이 왼쪽부터, 오늘 칸은 한 박자 늦게 크게 점화된다. */
const WEEK_AT_MS = 3950;
const WEEK_MS = 400;
const SLOT_AT_MS = 4100;
const SLOT_STAGGER_MS = 90;
const SLOT_MS = 380;
const TODAY_LAG_MS = 240;
const TODAY_MS = 560;
const CTA_AT_MS = 5200;
const CTA_MS = 480;
const EXIT_MS = 260;

const SETTLE = Easing.out(Easing.cubic);
const SLAM = Easing.out(Easing.back(1.8));
/** 끝에서 목표를 살짝 지나쳤다 돌아오는 비행 곡선. */
const SWOOP = Easing.bezier(0.55, 0, 0.2, 1.12);

const FLAME_SIZE = 168;
const STAGE_SIZE = 236;
/** 작은 화면에서는 히어로가 CTA 를 밀어내므로 불꽃·숫자를 같은 비율로 줄인다. */
const COMPACT_HEIGHT = 720;
const COMPACT_SCALE = 0.74;
/** 1막 불꽃 높이 상한(화면 대비). 폭은 살짝 넘쳐도 되지만 위아래가 잘리면 불꽃으로 안 읽힌다. */
const BIG_FLAME_WIDTH = 1.25;
const BIG_FLAME_HEIGHT = 0.7;

/** 점화 순간 불꽃 위로 솟구치는 불티. 좌표는 디자인 크기 기준이고 1막 배율만큼 커진다. */
/** 불꽃 몸통 위쪽에서 출발한다. */
const SPARK_ORIGIN_Y = -30;
const SPARKS = [
  { dx: -34, dy: -190, size: 7, start: 0.02 },
  { dx: 22, dy: -230, size: 6, start: 0 },
  { dx: -12, dy: -260, size: 5, start: 0.08 },
  { dx: 58, dy: -170, size: 6, start: 0.05 },
  { dx: -70, dy: -150, size: 5, start: 0.1 },
  { dx: 8, dy: -210, size: 7, start: 0.12 },
  { dx: 44, dy: -270, size: 4, start: 0.16 },
  { dx: -40, dy: -250, size: 4, start: 0.18 },
  { dx: 86, dy: -200, size: 4, start: 0.2 },
  { dx: -90, dy: -220, size: 4, start: 0.22 },
  { dx: 110, dy: -130, size: 3, start: 0.06 },
  { dx: -116, dy: -120, size: 3, start: 0.09 },
  { dx: 30, dy: -150, size: 5, start: 0.26 },
  { dx: -22, dy: -180, size: 5, start: 0.3 },
  { dx: 66, dy: -240, size: 3, start: 0.34 },
  { dx: -60, dy: -280, size: 3, start: 0.38 },
  { dx: 0, dy: -300, size: 4, start: 0.42 },
  { dx: 96, dy: -260, size: 3, start: 0.46 },
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
  // 어제가 프리즈였으면 꺼진 불 대신 얼어붙은 눈 결정이 깨지며 불이 붙는다.
  const frozen = slots.length >= 2 && slots[slots.length - 2].status === 'freeze';

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
  const flare = useSharedValue(0);
  const shake = useSharedValue(0);
  const fire = useSharedValue(0);
  const burst = useSharedValue(0);
  const travel = useSharedValue(0);
  const land = useSharedValue(0);
  const countIn = useSharedValue(0);
  const countSlam = useSharedValue(0);
  const headlineIn = useSharedValue(0);
  const subIn = useSharedValue(0);
  const weekIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);

  const ready = geometry !== null;

  useEffect(() => {
    if (!ready) return;
    enter.value = withTiming(1, { duration: FADE_IN_MS, easing: SETTLE });
    charge.value = withDelay(CHARGE_AT_MS, withTiming(1, { duration: CHARGE_MS, easing: Easing.in(Easing.quad) }));
    ignite.value = withDelay(IGNITE_AT_MS, withTiming(1, { duration: IGNITE_MS, easing: Easing.out(Easing.quad) }));
    flare.value = withDelay(
      WHOOSH_AT_MS,
      withSequence(
        withTiming(1, { duration: FLARE_UP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: FLARE_DOWN_MS, easing: Easing.out(Easing.cubic) }),
      ),
    );
    shake.value = withDelay(WHOOSH_AT_MS, withTiming(1, { duration: SHAKE_MS, easing: Easing.linear }));
    burst.value = withDelay(WHOOSH_AT_MS, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
    fire.value = withRepeat(withTiming(1, { duration: FIRE_LOOP_MS, easing: Easing.linear }), -1);
    travel.value = withDelay(TRAVEL_AT_MS, withTiming(1, { duration: TRAVEL_MS, easing: SWOOP }));
    land.value = withDelay(TRAVEL_AT_MS + TRAVEL_MS * 0.8, withTiming(1, { duration: LAND_MS, easing: Easing.out(Easing.cubic) }));
    countIn.value = withDelay(COUNT_AT_MS, withTiming(1, { duration: COUNT_MS, easing: SETTLE }));
    countSlam.value = withDelay(COUNT_SLAM_AT_MS, withTiming(1, { duration: COUNT_SLAM_MS, easing: SLAM }));
    headlineIn.value = withDelay(HEADLINE_AT_MS, withTiming(1, { duration: COPY_MS, easing: SETTLE }));
    subIn.value = withDelay(SUB_AT_MS, withTiming(1, { duration: COPY_MS, easing: SETTLE }));
    weekIn.value = withDelay(WEEK_AT_MS, withTiming(1, { duration: WEEK_MS, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: CTA_MS, easing: SLAM }));

    const all = [enter, exit, charge, ignite, flare, shake, fire, burst, travel, land, countIn, countSlam, headlineIn, subIn, weekIn, ctaIn];
    return () => {
      all.forEach(v => cancelAnimation(v));
    };
  }, [ready, enter, exit, charge, ignite, flare, shake, fire, burst, travel, land, countIn, countSlam, headlineIn, subIn, weekIn, ctaIn]);

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

  // 불길이 확 일 때 화면이 낮게 울린다 — 세게 흔들면 폭발처럼 읽힌다.
  const shakeStyle = useAnimatedStyle(() => {
    const t = shake.value;
    const amp = t >= 1 ? 0 : 7 * (1 - t) * (1 - t);
    return {
      transform: [
        { translateX: Math.sin(t * Math.PI * 7) * amp },
        { translateY: Math.cos(t * Math.PI * 5) * amp * 0.6 },
      ],
    };
  });

  const bgGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 1], [0.2, 1]),
  }));

  // 불이 바깥 겹까지 번지는 동안 얼어 있던 푸른 배경이 걷힌다.
  const coldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0.1, 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * flare.value,
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
      {frozen && (
        <Animated.View style={[StyleSheet.absoluteFill, coldStyle]} pointerEvents="none">
          <LinearGradient colors={[P.coldTop, P.coldMid, P.coldBottom]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="streakCelebrationCold" cx="50%" cy="50%" rx="70%" ry="45%">
                <Stop offset="0" stopColor={P.coldGlow} stopOpacity={0.3} />
                <Stop offset="1" stopColor={P.coldGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakCelebrationCold)" />
          </Svg>
        </Animated.View>
      )}

      <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
        <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.hero, { gap: 34 * fit }]} onLayout={onHeroLayout}>
            <View style={{ width: STAGE_SIZE * fit, height: STAGE_SIZE * fit }} onLayout={onStageLayout} />

            <View>
              <Rise progress={countSlam} from={0} scaleFrom={2.4}>
                <CountRow count={streak} fit={fit} />
              </Rise>
              <FadeOut progress={countSlam} style={styles.countBefore}>
                <Rise progress={countIn} from={10}>
                  <CountRow count={Math.max(0, streak - 1)} fit={fit} />
                </Rise>
              </FadeOut>
            </View>

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
            frozen={frozen}
            charge={charge}
            ignite={ignite}
            fire={fire}
            burst={burst}
            flare={flare}
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

/** progress 가 시작되자마자 빠르게 사라진다 — 내리꽂히는 N 에게 자리를 내준다. */
const FadeOut = React.memo(function FadeOut({
  progress,
  style,
  children,
}: {
  progress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

const CountRow = React.memo(function CountRow({ count, fit }: { count: number; fit: number }) {
  return (
    <View style={styles.countRow}>
      <Text style={[styles.count, { fontSize: 78 * fit, lineHeight: 84 * fit }]}>{count}</Text>
      <Text style={[styles.unit, { fontSize: 26 * fit, lineHeight: 42 * fit }]}>일 연속</Text>
    </View>
  );
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
  frozen: boolean;
  charge: SharedValue<number>;
  ignite: SharedValue<number>;
  fire: SharedValue<number>;
  burst: SharedValue<number>;
  flare: SharedValue<number>;
  travel: SharedValue<number>;
  land: SharedValue<number>;
}

/** 화면 한가운데 거대하게 점화된 뒤, travel 에 맞춰 stage 자리로 날아가며 1/zoom 로 줄어드는 불꽃. */
const FlameActor = React.memo(function FlameActor({
  geometry,
  frozen,
  charge,
  ignite,
  fire,
  burst,
  flare,
  travel,
  land,
}: FlameActorProps) {
  const { unit, zoom, actorSize, left, top, dx, dy } = geometry;
  const flameSize = FLAME_SIZE * unit;

  const actorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: travel.value * dx },
      { translateY: travel.value * dy },
      { scale: interpolate(travel.value, [0, 1], [1, 1 / zoom]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, ignite.value * (0.9 + 0.1 * lift(fire.value, 0)) + 0.3 * flare.value),
    transform: [
      {
        scale:
          interpolate(ignite.value, [0, 0.6, 1], [0.4, 1.12, 1], Extrapolation.CLAMP) *
          (1 + 0.55 * flare.value) *
          (1 + 0.03 * lift(fire.value, 0)) *
          interpolate(land.value, [0, 0.3, 1], [1, 1.2, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  // 힘을 모으며 살짝 움츠러들고 점점 세게 떨린다.
  const dimFlameStyle = useAnimatedStyle(() => {
    const c = charge.value;
    return {
      // 눈 결정은 Thaw 가 스스로 녹여 없앤다.
      opacity:
        interpolate(c, [0, 0.3], [0, 1], Extrapolation.CLAMP) *
        (frozen ? 1 : interpolate(ignite.value, [0.15, 0.5], [1, 0], Extrapolation.CLAMP)),
      transform: [
        { translateX: Math.sin(c * Math.PI * 22) * 6 * c * c },
        { scale: interpolate(c, [0, 1], [1, 0.88]) },
      ],
    };
  });

  const litFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(land.value, [0, 0.25, 1], [1, 1.08, 1], Extrapolation.CLAMP) }],
  }));

  // 확 치솟을 때 밑동을 축으로 키가 훌쩍 커졌다가 내려앉는다.
  const flareStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + 0.42 * flare.value }, { scaleX: 1 + 0.1 * flare.value }],
  }));

  // 치솟는 순간 불꽃 아래쪽에서 뜨거운 빛 덩어리가 부풀며 흩어진다.
  const puffStyle = useAnimatedStyle(() => {
    const t = interpolate(burst.value, [0, 0.45], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.12, 1], [0, 0.95, 0], Extrapolation.CLAMP),
      transform: [{ translateY: flameSize * 0.12 - t * flameSize * 0.2 }, { scale: interpolate(t, [0, 1], [0.3, 2.1]) }],
    };
  });

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

      <Animated.View style={[styles.stageCenter, dimFlameStyle]}>
        {frozen ? (
          <Thaw ignite={ignite} size={flameSize * 0.92} />
        ) : (
          <Ionicons name="flame" size={flameSize} color={P.flameOff} />
        )}
      </Animated.View>

      <Animated.View style={[styles.stageCenter, litFlameStyle]}>
        <Animated.View style={[styles.flameBox, styles.flameOrigin, { width: flameSize, height: flameSize }, flareStyle]}>
          {EMBERS.map((ember, i) => (
            <Ember key={i} fire={fire} ignite={ignite} flameSize={flameSize} {...ember} />
          ))}
          {FLAME_LAYERS.map((layer, i) => (
            <FlameLayer key={i} fire={fire} ignite={ignite} flameSize={flameSize} {...layer} />
          ))}
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.stageCenter, puffStyle]}>
        <Svg width={flameSize} height={flameSize}>
          <Defs>
            <RadialGradient id="streakFlamePuff" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={P.flameCore} stopOpacity={0.95} />
              <Stop offset="0.35" stopColor={P.flameMid} stopOpacity={0.55} />
              <Stop offset="1" stopColor={P.flameOuter} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#streakFlamePuff)" />
        </Svg>
      </Animated.View>

      {SPARKS.map((spark, i) => (
        <Spark key={i} burst={burst} unit={unit} {...spark} />
      ))}
    </Animated.View>
  );
});

interface FlameLayerProps {
  fire: SharedValue<number>;
  ignite: SharedValue<number>;
  flameSize: number;
  color: string;
  ratio: number;
  top: number;
  stretch: number;
  sway: number;
  lag: number;
  catchAt: readonly [number, number];
}

const FlameLayer = React.memo(function FlameLayer({
  fire,
  ignite,
  flameSize,
  color,
  ratio,
  top,
  stretch,
  sway,
  lag,
  catchAt,
}: FlameLayerProps) {
  const [from, to] = catchAt;
  const style = useAnimatedStyle(() => {
    const up = lift(fire.value, lag);
    const c = interpolate(ignite.value, [from, to], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(c, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [
        // 밑동에서 가늘고 길게 솟았다가 제 폭으로 퍼진다.
        { scaleY: interpolate(c, [0, 0.6, 1], [0.05, 1.12, 1]) * (1 + stretch * up) },
        { scaleX: interpolate(c, [0, 0.6, 1], [0.3, 0.92, 1]) * (1 - stretch * 0.4 * up) },
        { skewX: `${sway * lean(fire.value, lag)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.flameLayer, styles.flameOrigin, { top: flameSize * top }, style]}>
      <Ionicons name="flame" size={flameSize * ratio} color={color} />
    </Animated.View>
  );
});

interface LoopParticleProps {
  fire: SharedValue<number>;
  flameSize: number;
  cycles: number;
  offset: number;
  /** 불꽃 폭 대비 가로 출발점. */
  dx: number;
  /** 불꽃 크기 대비. */
  size: number;
}

const Ember = React.memo(function Ember({
  fire,
  ignite,
  flameSize,
  cycles,
  offset,
  dx,
  size,
}: LoopParticleProps & { ignite: SharedValue<number> }) {
  const s = flameSize * size;
  const style = useAnimatedStyle(() => {
    const p = (fire.value * cycles + offset) % 1;
    return {
      opacity: interpolate(ignite.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) * interpolate(p, [0, 0.2, 0.7, 1], [0, 0.9, 0.6, 0]),
      transform: [
        { translateX: flameSize * dx * (1 - p * 0.4) + Math.sin(2 * Math.PI * (p + offset)) * flameSize * 0.025 },
        { translateY: -p * flameSize * 0.85 },
        { scale: 1 - p * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.ember, { width: s, height: s, top: flameSize * 0.45, marginLeft: -s / 2 }, style]}
    />
  );
});

/** 눈 결정이 불빛에 달아오르듯 주황으로 물든 뒤, 밑동 쪽으로 녹아 주저앉으며 불 속으로 사라진다. */
const Thaw = React.memo(function Thaw({ ignite, size }: { ignite: SharedValue<number>; size: number }) {
  const wrapStyle = useAnimatedStyle(() => {
    const t = interpolate(ignite.value, [0.1, 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - t,
      transform: [{ scaleY: 1 - 0.55 * t }, { scaleX: 1 + 0.08 * t }],
    };
  });
  const warmStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ignite.value, [0, 0.2], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.flameOrigin, wrapStyle]}>
      <Ionicons name="snow" size={size} color={P.iceInk} />
      <Animated.View style={[StyleSheet.absoluteFill, warmStyle]}>
        <Ionicons name="snow" size={size} color={P.flameMid} />
      </Animated.View>
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
        // 불길을 타고 오르며 좌우로 흔들린다.
        { translateX: (dx * t + Math.sin((t * 2 + start) * Math.PI * 2) * 6) * unit },
        { translateY: (SPARK_ORIGIN_Y + dy * t) * unit },
        { scale: interpolate(t, [0, 0.15, 1], [0.4, 1, 0.3], Extrapolation.CLAMP) },
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
  flameBox: {
    alignItems: 'center',
  },
  flameLayer: {
    position: 'absolute',
  },
  flameOrigin: {
    transformOrigin: 'bottom',
  },
  ember: {
    position: 'absolute',
    left: '50%',
    borderRadius: 999,
    backgroundColor: P.spark,
  },
  spark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    backgroundColor: P.spark,
  },
  // N-1 과 N 은 자리수가 다를 수 있어 가운데를 맞춰 겹친다.
  countBefore: {
    position: 'absolute',
    left: -100,
    right: -100,
    top: 0,
    alignItems: 'center',
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
