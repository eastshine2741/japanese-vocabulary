import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
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
  FadeIn,
  FadeOut,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardEnvelope from './CardEnvelope';
import { hapticBurst, hapticCharge, hapticRung, hapticSettle, hapticSpin, hapticTear } from './cardHaptics';
import { SHOWROOM, SHOWROOM_HEADING_TOP } from './cardTheme';
import { fitFontSize } from './fitFontSize';
import { seededRandom } from './seededRandom';
import { CardTilt } from './useCardTilt';

const PACK_AT_MS = 180;
/** 다 찢고 이만큼 숨을 모은 뒤 터진다 — 방이 어두워지고 찢긴 틈으로 빛이 새어 나온다. */
const LAND_DELAY_MS = 320;
/** 터진 뒤 카드가 봉투에서 떠올라 커지며 눈에 들어오는 시간. 끝에 제자리에 박힌다. */
const EMERGE_MS = 1800;
/** 떠오르는 동안 세로축으로 도는 바퀴 수. 터질 땐 초당 12바퀴로 돌다 점점 느려지며 앞면에서 멈춘다. */
const SPIN_TURNS = 7;
const SETTLE_AT_MS = LAND_DELAY_MS + EMERGE_MS;
const WHITEOUT_MS = 45 + 70 + 900;
/** 제자리에 박히기 직전 살짝 넘치게 커졌다가 줄어든다. */
const CARD_PEAK_SCALE = 1.12;
const STRIP_OFF_MS = 420;
const DROP_MS = 700;
const COPY_DELAY_MS = SETTLE_AT_MS + 300;
const CTA_DELAY_MS = COPY_DELAY_MS + 300;
const LIVE_FADE_MS = 240;
/** 봉투에서 막 나올 때의 크기. 제자리에 오며 1 로 커진다. */
const CARD_START_SCALE = 0.72;
/** 찢긴 단면이 들쭉날쭉하도록 이만큼 갈 때마다 점을 찍는다. */
const TRAIL_STEP = 5;
/** 이만큼 뜯고 놓으면 끝까지 뜯는다. */
const TEAR_COMMIT = 0.55;
const TEAR_TICKS = 8;
const SETTLE = Easing.out(Easing.cubic);

export interface RevealMotion {
  rise: SharedValue<number>;
  /** 0→1 봉투 윗부분을 찢은 정도. 손가락 x 를 봉투 폭으로 나눈 값. */
  tear: SharedValue<number>;
  /** 다 찢긴 윗조각이 날아가는 진행. */
  stripOff: SharedValue<number>;
  /** 봉투가 떨어져 사라지는 진행. */
  drop: SharedValue<number>;
  /** 0→1 카드가 봉투 안에서 화면 가운데로 나오는 진행. 넘쳤다 돌아온다. */
  pull: SharedValue<number>;
  /** 뽑혀 나오며 커지는 스프링. 넘쳤다 돌아온다. */
  pop: SharedValue<number>;
  /** 폭죽이 퍼져 떨어지는 진행. */
  burst: SharedValue<number>;
  hint: SharedValue<number>;
  flash: SharedValue<number>;
  /** 카드가 세로축으로 돈 각도(도). */
  spin: SharedValue<number>;
  /** 0→1 터지기 직전 모이는 힘. 터지면 0 으로 풀린다. */
  charge: SharedValue<number>;
  ring: SharedValue<number>;
  pulse: SharedValue<number>;
  copyIn: SharedValue<number>;
  ctaIn: SharedValue<number>;
  liveIn: SharedValue<number>;
  /** 다 뜯어 공개 연출이 시작됐다. */
  opened: boolean;
  /** 착지 연출이 끝나 기울기 효과가 있는 카드를 겹치기 시작했다. 봉투도 이때 뗀다. */
  live: boolean;
  /** 겹치기가 끝나 정적 카드를 뗐다. */
  settled: boolean;
  /** 다 뜯었을 때 한 번 부른다. */
  open: () => void;
}

/**
 * 획득 연출의 시간표. 다른 단계로 갔다 돌아와도 다시 돌지 않게 흐름 쪽에서 한 번만 잡는다.
 * started 는 화면 전환이 끝났다는 신호다 — 전환과 겹치지 않게 그때 봉투를 띄운다. 공개는 유저가 봉투를 뜯어야 시작한다.
 */
export function useRevealMotion(started: boolean): RevealMotion {
  const [opened, setOpened] = useState(false);
  const [live, setLive] = useState(false);
  const [settled, setSettled] = useState(false);
  const rise = useSharedValue(0);
  const tear = useSharedValue(0);
  const stripOff = useSharedValue(0);
  const drop = useSharedValue(0);
  const pull = useSharedValue(0);
  const pop = useSharedValue(0);
  const burst = useSharedValue(0);
  const hint = useSharedValue(0);
  const flash = useSharedValue(0);
  const charge = useSharedValue(0);
  const spin = useSharedValue(0);
  const ring = useSharedValue(0);
  const pulse = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const liveIn = useSharedValue(0);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!started) return;
    rise.value = withDelay(PACK_AT_MS, withTiming(1, { duration: 520, easing: SETTLE }));
    hint.value = withDelay(PACK_AT_MS + 500, withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [started, rise, hint]);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    const land = LAND_DELAY_MS;
    const settle = SETTLE_AT_MS;
    hapticCharge(land);
    stripOff.value = withTiming(1, { duration: STRIP_OFF_MS, easing: Easing.out(Easing.quad) });
    charge.value = withSequence(
      withTiming(1, { duration: land, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 380, easing: SETTLE }),
    );
    // 화면이 한순간 하얗게 날아갔다가 천천히 돌아오고, 카드가 박힐 때 한 번 더 번쩍인다.
    flash.value = withDelay(
      land,
      withSequence(
        withTiming(1, { duration: 45 }, (finished) => {
          if (finished) runOnJS(hapticBurst)();
        }),
        withDelay(70, withTiming(0, { duration: 900, easing: SETTLE })),
        withDelay(EMERGE_MS - WHITEOUT_MS, withTiming(0.5, { duration: 40 })),
        withTiming(0, { duration: 520, easing: SETTLE }),
      ),
    );
    spin.value = withDelay(land, withTiming(360 * SPIN_TURNS, { duration: EMERGE_MS, easing: Easing.out(Easing.cubic) }));
    const peak = (CARD_PEAK_SCALE - CARD_START_SCALE) / (1 - CARD_START_SCALE);
    pop.value = withDelay(
      land,
      withSequence(
        withTiming(peak, { duration: EMERGE_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
          if (finished) runOnJS(hapticSettle)();
        }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      ),
    );
    pull.value = withDelay(land, withTiming(1, { duration: EMERGE_MS * 0.75, easing: Easing.out(Easing.cubic) }));
    drop.value = withDelay(land + 250, withTiming(1, { duration: DROP_MS, easing: Easing.in(Easing.cubic) }));
    burst.value = withDelay(settle, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
    ring.value = withDelay(
      settle,
      withTiming(1, { duration: 900, easing: SETTLE }, (finished) => {
        if (finished) runOnJS(setLive)(true);
      }),
    );
    pulse.value = withDelay(settle, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    copyIn.value = withDelay(COPY_DELAY_MS, withTiming(1, { duration: 420, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_DELAY_MS, withTiming(1, { duration: 360, easing: SETTLE }));
  }, [stripOff, charge, spin, flash, pop, pull, drop, burst, ring, pulse, copyIn, ctaIn]);

  useEffect(() => {
    if (!live) return;
    liveIn.value = withTiming(1, { duration: LIVE_FADE_MS }, (finished) => {
      if (finished) runOnJS(setSettled)(true);
    });
  }, [live, liveIn]);

  return {
    rise,
    tear,
    stripOff,
    drop,
    pull,
    pop,
    burst,
    hint,
    flash,
    charge,
    spin,
    ring,
    pulse,
    copyIn,
    ctaIn,
    liveIn,
    opened,
    live,
    settled,
    open,
  };
}

/**
 * 획득 화면 단계 사이의 뒤로 가기. 첫 단계에서는 막는다 — 서명 없이 닫히면 서명할 기회가 다시 없다.
 * 서명한 뒤에도 되돌아갈 곳이 없다.
 */
export function useRevealBackGuard(atFirstStep: boolean, signed: boolean, onBack: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!atFirstStep && !signed) onBack();
      return true;
    });
    return () => sub.remove();
  }, [atFirstStep, signed, onBack]);
}

interface ShellProps {
  backdropUri: string;
  /** charge 가 없으면 화면을 어둡게 누르지 않는다. */
  motion: { flash: SharedValue<number>; charge?: SharedValue<number> };
  children: React.ReactNode;
}

/** 흐린 아트 배경과 착지 섬광. 단계가 바뀌어도 그대로 남는다. */
export const RevealShell = React.memo(function RevealShell({ backdropUri, motion, children }: ShellProps) {
  const flashStyle = useAnimatedStyle(() => ({ opacity: motion.flash.value }));
  const { charge } = motion;
  const dimStyle = useAnimatedStyle(() => ({ opacity: charge ? 0.6 * charge.value : 0 }));
  return (
    <View style={styles.root}>
      <Image source={{ uri: backdropUri }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}E0`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {charge && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />}
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </View>
  );
});

interface IntroProps {
  motion: RevealMotion;
  tilt: CardTilt;
  accent: string;
  width: number;
  /** 세로 / 가로. */
  ratio: number;
  /** 모서리 반경, 카드 폭 비율. */
  radius: number;
  /** 봉투에서 뽑혀 나오는 동안 쓰는 효과 없는 앞면. */
  front: React.ReactNode;
  /** 돌며 나오는 동안 비치는 뒷면. */
  back: React.ReactNode;
  /** 착지 뒤 기울기 효과가 있는 카드. */
  showcase: React.ReactNode;
  /** 카드 위 한 줄. 곡명·이름은 카드에 이미 있어 무슨 카드인지만 말한다. */
  heading: string;
  /** 카드 아래 — 이 카드가 무엇이고 어떻게 오르는지. */
  guide: React.ReactNode;
  actions: React.ReactNode;
}

/** 화면 아래 걸친 봉투를 뜯으면 카드가 가운데로 뽑혀 나오는 첫 단계. */
export const RevealIntro = React.memo(function RevealIntro({
  motion,
  tilt,
  accent,
  width,
  ratio,
  radius,
  front,
  back,
  showcase,
  heading,
  guide,
  actions,
}: IntroProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { rise, tear, stripOff, drop, pull, pop, hint, charge, spin, ring, pulse, copyIn, ctaIn, liveIn, opened, live, settled, open } = motion;
  const height = width * ratio;
  const envW = Math.min(screenW - 32, 440);
  const envR = envW * 0.045;
  const perfY = envW * 0.14;
  const bandTop = envR + 6;
  const bandBottom = envW * 0.29;
  const [stepH, setStepH] = useState(0);
  const [stageMid, setStageMid] = useState(0);
  // 찢는 띠가 화면 한가운데 오게 봉투를 올리고, 아래 끝은 화면 밖까지 늘린다.
  const shown = stepH > 0 ? stepH / 2 + (bandTop + bandBottom) / 2 : envW * 0.75;
  const envH = Math.max(envW * 1.3, shown + envW * 0.15);
  const trail = useSharedValue<number[]>([0, perfY]);
  const tipY = useSharedValue(perfY);
  // 카드는 찢을 수 있는 띠 바로 아래에서 출발한다 — 몸통이 앞에 있어 나오기 전엔 가려진다.
  const fromY = stepH - shown + bandBottom + 12 + height / 2 - stageMid;

  const handleStepLayout = useCallback((e: LayoutChangeEvent) => setStepH(e.nativeEvent.layout.height), []);
  const handleStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    setStageMid(y + h / 2);
  }, []);

  // 카드 옆면이 지날 때마다 — 빠를 땐 촘촘히, 느려지며 띄엄띄엄.
  useAnimatedReaction(
    () => Math.floor((spin.value + 90) / 180),
    (n, prev) => {
      if (prev !== null && n > prev) runOnJS(hapticSpin)(spin.value / (360 * SPIN_TURNS));
    },
  );

  useAnimatedReaction(
    () => Math.floor(tear.value * TEAR_TICKS),
    (n, prev) => {
      if (prev !== null && n > prev && n < TEAR_TICKS) runOnJS(hapticTear)(n / TEAR_TICKS);
    },
  );

  const tearGesture = useMemo(() => {
    const commit = () => {
      'worklet';
      tear.value = withTiming(1, { duration: 140 }, (finished) => {
        if (finished) runOnJS(open)();
      });
    };
    const clampY = (y: number) => {
      'worklet';
      return Math.min(bandBottom, Math.max(bandTop, y));
    };
    // 찢긴 끝이 손가락 바로 밑에 오도록 이동량이 아닌 손가락 자리를 그대로 쓰고, 지나간 자리를 찢긴 선으로 남긴다.
    const pan = Gesture.Pan()
      .enabled(!opened)
      .activeOffsetX([-8, 8])
      .onStart((e) => {
        if (tear.value === 0) trail.value = [0, clampY(e.y)];
      })
      .onUpdate((e) => {
        const x = Math.min(envW, Math.max(0, e.x));
        // 찢긴 종이는 되돌아가도 다시 붙지 않는다.
        if (x <= tear.value * envW) return;
        const y = clampY(e.y);
        const kept = trail.value.slice();
        if (x - kept[kept.length - 2] >= TRAIL_STEP) {
          // 종이 결처럼 단면이 미세하게 들쭉날쭉하다.
          const jag = ((kept.length * 37) % 5) - 2;
          kept.push(x, clampY(y + jag * 0.8));
        }
        trail.value = kept;
        tipY.value = y;
        tear.value = x / envW;
      })
      .onEnd((e) => {
        if (tear.value >= TEAR_COMMIT || e.velocityX > 900) commit();
      });
    // 밀 줄 모르고 눌러도 뜯긴다.
    const tap = Gesture.Tap()
      .enabled(!opened)
      .onEnd(() => {
        // 찢다 만 자리에서 그 높이 그대로 마저 찢는다.
        const torn = tear.value > 0;
        const y = torn ? tipY.value : perfY;
        const line = torn ? trail.value.slice() : [0, perfY];
        for (let x = line[line.length - 2] + TRAIL_STEP; x < envW; x += TRAIL_STEP) {
          line.push(x, clampY(y + (((line.length * 37) % 5) - 2) * 0.8));
        }
        trail.value = line;
        tipY.value = y;
        tear.value = withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(open)();
        });
      });
    return Gesture.Exclusive(pan, tap);
  }, [envW, bandTop, bandBottom, perfY, opened, open, tear, trail, tipY]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - pull.value) * fromY },
      { scale: CARD_START_SCALE + (1 - CARD_START_SCALE) * pop.value },
    ],
  }));
  const envStyle = useAnimatedStyle(() => ({
    // 레이아웃을 재고 나면 bottom 은 바로 바뀌지만 transform 은 한 프레임 늦어 제자리에 비친다 — 떠오르기 전엔 숨긴다.
    opacity: rise.value > 0 ? 1 : 0,
    transform: [
      { translateY: (1 - rise.value) * (shown + 40) + drop.value * (shown + 60) },
      // 터지기 직전 안에서 밀어 올리듯 부푼다.
      { scale: 1 + 0.04 * charge.value },
    ],
  }));
  const leakStyle = useAnimatedStyle(() => ({ opacity: charge.value }));
  // 앞뒷면을 따로 돌려 각도로 하나만 보인다 — backfaceVisibility 는 안드로이드에서 믿을 수 없다.
  const frontFaceStyle = useAnimatedStyle(() => ({
    opacity: Math.cos((spin.value * Math.PI) / 180) >= 0 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${spin.value}deg` }],
  }));
  const backFaceStyle = useAnimatedStyle(() => ({
    opacity: Math.cos((spin.value * Math.PI) / 180) < 0 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${spin.value + 180}deg` }],
  }));
  const leakH = envW * 0.9;
  const hintStyle = useAnimatedStyle(() => ({
    opacity: rise.value * Math.max(0, 1 - tear.value * 4) * (0.6 + 0.4 * hint.value),
    transform: [{ translateY: (1 - rise.value) * (shown + 40) }, { translateX: hint.value * 6 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: ring.value * (0.75 + 0.25 * pulse.value),
    transform: [{ scale: 0.9 + 0.08 * pulse.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.8, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 1.7]) }],
  }));
  const liveStyle = useAnimatedStyle(() => ({ opacity: liveIn.value }));
  const glowSize = Math.max(width, height) * 2.2;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      onLayout={handleStepLayout}
      style={[styles.step, { paddingTop: insets.top + SHOWROOM_HEADING_TOP, paddingBottom: insets.bottom + 16 }]}
    >
      <Rise progress={copyIn} from={10} style={styles.headingWrap}>
        <Text style={styles.heading}>{heading}</Text>
      </Rise>

      <View style={styles.stage} onLayout={handleStageLayout}>
        <Animated.View
          pointerEvents="none"
          renderToHardwareTextureAndroid
          style={[styles.glow, { width: glowSize, height: glowSize }, glowStyle]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="rewardCardGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.55} />
                <Stop offset="0.5" stopColor={accent} stopOpacity={0.16} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#rewardCardGlow)" />
          </Svg>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { width: width * 1.1, height: height * 1.1, borderColor: accent, borderRadius: width * radius * 1.7 },
            ringStyle,
          ]}
        />
        {/* 다 뜯기 전엔 카드를 그리지 않는다. 움직이는 틀은 미리 붙여 둔다 — 카드와 함께 붙이면 첫 프레임에 변형 없이 제자리에 비친다. */}
        <Animated.View style={[{ width, height }, cardStyle]}>
          {opened && !settled && (
            <>
              <Animated.View
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={[styles.stillCard, { width, height, borderRadius: width * radius }, frontFaceStyle]}
              >
                {front}
              </Animated.View>
              {!live && (
                <Animated.View
                  renderToHardwareTextureAndroid
                  shouldRasterizeIOS
                  style={[styles.stillCard, styles.over, { width, height, borderRadius: width * radius }, backFaceStyle]}
                >
                  {back}
                </Animated.View>
              )}
            </>
          )}
          {live && (
            <Animated.View style={[settled ? null : styles.over, liveStyle]}>
              <GestureDetector gesture={tilt.gesture}>
                <View>{showcase}</View>
              </GestureDetector>
            </Animated.View>
          )}
        </Animated.View>
        <Confetti burst={motion.burst} reach={Math.max(width, height) * 1.05} accent={accent} />
      </View>

      <Rise progress={copyIn} from={14} style={styles.guide}>
        {guide}
      </Rise>

      <Rise progress={ctaIn} from={20} style={styles.actions}>
        {actions}
      </Rise>

      {!live && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {!opened && (
            <Animated.View pointerEvents="none" style={[styles.hint, { bottom: shown + 20 }, hintStyle]}>
              <Text style={styles.hintText}>옆으로 밀어서 뜯기</Text>
              <Feather name="chevrons-right" size={16} color={SHOWROOM.fgDim} />
            </Animated.View>
          )}
          <GestureDetector gesture={tearGesture}>
            <Animated.View
              style={[
                styles.envelope,
                { width: envW, height: envH, left: (screenW - envW) / 2, bottom: shown - envH, transformOrigin: [envW / 2, bandBottom, 0] },
                envStyle,
              ]}
            >
              {opened && (
                <Animated.View pointerEvents="none" style={[styles.leak, { top: bandBottom - leakH, height: leakH }, leakStyle]}>
                  <LinearGradient colors={[`${accent}00`, `${accent}80`, '#FFFFFFF0']} locations={[0, 0.72, 1]} style={StyleSheet.absoluteFill} />
                </Animated.View>
              )}
              <CardEnvelope
                width={envW}
                height={envH}
                radius={envR}
                accent={accent}
                perfY={perfY}
                bandBottom={bandBottom}
                trail={trail}
                tear={tear}
                tipY={tipY}
                stripOff={stripOff}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      )}
    </Animated.View>
  );
});

interface StepProps {
  /** null 이면 뒤로 가기 자리를 비운다. */
  onBack: (() => void) | null;
  children: React.ReactNode;
}

/** 첫 단계 뒤의 단계들(가사 고르기·서명). 단계마다 새로 떠오르게 부르는 쪽에서 key 를 단계로 준다. */
export const RevealStep = React.memo(function RevealStep({ onBack, children }: StepProps) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(240)} style={[styles.step, { paddingTop: insets.top + 4 }]}>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color={SHOWROOM.fg} />
          </Pressable>
        ) : (
          <View style={styles.iconSlot} />
        )}
      </View>
      {children}
    </Animated.View>
  );
});

export interface LadderStep {
  label: string;
  /** 그 계단에 오르는 조건을 짧게. */
  caption: string;
}

interface GuideProps {
  lines: string[];
  steps: readonly LadderStep[];
  /** 지금 계단의 index. */
  current: number;
  /** 등급이 오를 때 — 처음부터 이 칸까지 차 있고, 그 다음 칸부터 채운다. */
  from?: number;
  accent: string;
  /** 문구가 다 떠오르면 계단을 채우기 시작한다. */
  motion: Pick<RevealMotion, 'copyIn' | 'pulse'>;
}

const RUNG_MS = 300;
const RUNG_PAD = 2;
/** 첫 칸도 차오르는 게 보이도록 왼쪽 바깥에서 출발한다. */
const FILL_FROM = -0.5;

/** 설명 몇 줄과 승급 계단. 지금 자리까지 한 칸씩 차올라 다음 목표가 따로 말하지 않아도 보이게 한다. */
export const RevealGuide = React.memo(function RevealGuide({ lines, steps, current, from, accent, motion }: GuideProps) {
  const { copyIn, pulse } = motion;
  // 가사 고르기에서 돌아오면 다시 채우지 않는다.
  const fill = useSharedValue(copyIn.value >= 1 ? current : (from ?? FILL_FROM));
  const [ladderW, setLadderW] = useState(0);
  const handleLadderLayout = useCallback((e: LayoutChangeEvent) => setLadderW(e.nativeEvent.layout.width), []);
  // 칸마다 따로 줄이면(adjustsFontSizeToFit) 안드로이드에서 글자가 찌그러져, 한 크기로 맞춘다.
  const textW = ladderW / steps.length - RUNG_PAD * 2;
  const labelSize = useMemo(() => fitFontSize(steps.map((s) => s.label), textW, 12), [steps, textW]);
  const captionSize = useMemo(() => fitFontSize(steps.map((s) => s.caption), textW, 11), [steps, textW]);

  const run = useCallback(() => {
    const first = from === undefined ? 0 : from + 1;
    if (first > current) return;
    const legs = Array.from({ length: current - first + 1 }, (_, j) => {
      const k = first + j;
      return withTiming(k, { duration: k === 0 ? 200 : RUNG_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(hapticRung)(k === current);
      });
    });
    fill.value = withSequence(...legs);
  }, [current, from, fill]);

  useAnimatedReaction(
    () => copyIn.value >= 1,
    (ready, was) => {
      if (ready && was === false) runOnJS(run)();
    },
  );

  return (
    <>
      {lines.map((line) => (
        <Text key={line} style={styles.guideLine}>{line}</Text>
      ))}
      <View style={styles.ladder} onLayout={handleLadderLayout}>
        {steps.map((step, i) => (
          <Rung
            key={step.label}
            step={step}
            index={i}
            last={i === steps.length - 1}
            current={current}
            accent={accent}
            fill={fill}
            pulse={pulse}
            labelSize={labelSize}
            captionSize={captionSize}
          />
        ))}
      </View>
    </>
  );
});

interface RungProps {
  step: LadderStep;
  index: number;
  last: boolean;
  current: number;
  accent: string;
  fill: SharedValue<number>;
  pulse: SharedValue<number>;
  labelSize: number;
  captionSize: number;
}

const Rung = React.memo(function Rung({ step, index: i, last, current, accent, fill, pulse, labelSize, captionSize }: RungProps) {
  const isNow = i === current;
  const hit = useSharedValue(1);

  useAnimatedReaction(
    () => fill.value >= i - 0.001,
    (on, was) => {
      if (on && was === false) {
        hit.value = withSequence(withTiming(isNow ? 2.1 : 1.7, { duration: 110 }), withTiming(1, { duration: 220, easing: SETTLE }));
      }
    },
  );

  // 왼쪽 반은 i-0.5→i, 오른쪽 반은 i→i+0.5 에서 찬다.
  const leftStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, (fill.value - (i - 0.5)) / 0.5)) * 100}%`,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, (fill.value - i) / 0.5)) * 100}%`,
  }));
  const dotStyle = useAnimatedStyle(() => {
    const reached = fill.value >= i - 0.001;
    const breathe = isNow && reached ? 1 + 0.15 * pulse.value : 1;
    return { opacity: reached ? 1 : 0, transform: [{ scale: hit.value * breathe }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const reached = fill.value >= i - 0.001;
    return {
      opacity: reached ? 0.25 + 0.35 * pulse.value : 0,
      transform: [{ scale: 1.4 + 0.6 * pulse.value }],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fill.value, [i - 0.15, i], [0.55, 1], 'clamp'),
  }));

  return (
    <View style={styles.rung}>
      <View style={styles.rungTrack}>
        <View style={[styles.rungLine, i === 0 && styles.hidden]}>
          <Animated.View style={[styles.rungFill, { backgroundColor: accent }, leftStyle]} />
        </View>
        <View style={styles.rungDotSlot}>
          {isNow && <Animated.View style={[styles.rungHalo, { backgroundColor: accent }, haloStyle]} />}
          <View style={[styles.rungDot, isNow && styles.rungDotNowSize]} />
          <Animated.View
            style={[styles.rungDot, styles.rungDotOver, isNow && styles.rungDotNow, { backgroundColor: accent }, dotStyle]}
          />
        </View>
        <View style={[styles.rungLine, last && styles.hidden]}>
          <Animated.View style={[styles.rungFill, { backgroundColor: accent }, rightStyle]} />
        </View>
      </View>
      <Animated.View style={[styles.rungText, textStyle]}>
        <Text style={[styles.rungLabel, isNow && styles.rungLabelNow, { fontSize: labelSize }]} numberOfLines={1}>
          {step.label}
        </Text>
        <Text style={[styles.rungCaption, { fontSize: captionSize }]} numberOfLines={1}>
          {step.caption}
        </Text>
      </Animated.View>
    </View>
  );
});

const CONFETTI_COUNT = 30;
const CONFETTI_COLORS = ['#FFFFFF', '#FFD54A', '#FF6B9A', '#5BD1FF'];

interface Piece {
  angle: number;
  /** reach 배수. */
  dist: number;
  fall: number;
  turns: number;
  w: number;
  h: number;
  color: string | null;
}

/** 터지는 순간 사방으로 튀어 떨어지는 조각. 같은 모양이 매번 나오게 시드를 고정한다. */
const Confetti = React.memo(function Confetti({ burst, reach, accent }: { burst: SharedValue<number>; reach: number; accent: string }) {
  const pieces = useMemo<Piece[]>(() => {
    const rand = seededRandom('reward-card-confetti');
    return Array.from({ length: CONFETTI_COUNT }, (_, k) => ({
      angle: (k / CONFETTI_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.4,
      dist: 0.55 + rand() * 0.5,
      fall: 60 + rand() * 120,
      turns: (rand() - 0.5) * 6,
      w: 5 + rand() * 4,
      h: 8 + rand() * 7,
      // 셋 중 하나는 카드 색.
      color: k % 3 === 0 ? null : CONFETTI_COLORS[k % CONFETTI_COLORS.length],
    }));
  }, []);
  return (
    <>
      {pieces.map((piece, k) => (
        <ConfettiPiece key={k} piece={piece} burst={burst} reach={reach} accent={accent} />
      ))}
    </>
  );
});

interface PieceProps {
  piece: Piece;
  burst: SharedValue<number>;
  reach: number;
  accent: string;
}

const ConfettiPiece = React.memo(function ConfettiPiece({ piece, burst, reach, accent }: PieceProps) {
  const style = useAnimatedStyle(() => {
    const e = burst.value;
    const d = piece.dist * reach * e;
    return {
      opacity: e <= 0 ? 0 : interpolate(e, [0, 0.04, 0.65, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(piece.angle) * d },
        { translateY: Math.sin(piece.angle) * d + piece.fall * e * e },
        { rotate: `${piece.turns * 360 * e}deg` },
        { scale: interpolate(e, [0, 0.1, 1], [0.3, 1, 0.7]) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.piece, { width: piece.w, height: piece.h, backgroundColor: piece.color ?? accent }, style]}
    />
  );
});

interface ButtonProps {
  label: string;
  onPress: () => void;
}

export const RevealPrimaryButton = React.memo(function RevealPrimaryButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
});

export const RevealSecondaryButton = React.memo(function RevealSecondaryButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
});

interface RiseProps {
  progress: SharedValue<number>;
  from: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const Rise = React.memo(function Rise({ progress, from, style, children }: RiseProps) {
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * from }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.5, transform: [{ scale: 1.3 }] },
  step: { flex: 1 },
  headingWrap: { alignItems: 'center', paddingHorizontal: 24 },
  heading: { color: SHOWROOM.fg, fontSize: 20, fontWeight: '700' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2 },
  envelope: { position: 'absolute' },
  stillCard: { overflow: 'hidden' },
  hint: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  hintText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  over: { position: 'absolute', top: 0, left: 0 },
  guide: { alignItems: 'center', paddingHorizontal: 24, gap: 2 },
  guideLine: { color: SHOWROOM.fgDim, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  ladder: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 14 },
  rung: { flex: 1, alignItems: 'center', paddingHorizontal: RUNG_PAD },
  rungTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 16, marginBottom: 6 },
  rungLine: { flex: 1, height: 2, backgroundColor: SHOWROOM.line },
  rungFill: { height: 2 },
  rungDotSlot: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  rungDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SHOWROOM.line },
  rungDotNowSize: { width: 14, height: 14, borderRadius: 7 },
  rungDotOver: { position: 'absolute' },
  rungDotNow: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: SHOWROOM.fg },
  rungHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  rungText: { alignItems: 'center', alignSelf: 'stretch' },
  rungLabel: { color: SHOWROOM.fgDim, fontWeight: '600' },
  rungLabelNow: { color: SHOWROOM.fg, fontWeight: '800' },
  rungCaption: { color: SHOWROOM.fgDim, marginTop: 1 },
  hidden: { opacity: 0 },
  actions: { paddingHorizontal: 24, paddingTop: 24, gap: 6 },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  topBar: { flexDirection: 'row', paddingHorizontal: 16 },
  iconSlot: { width: 40, height: 40 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: { backgroundColor: '#FFFFFF' },
  dim: { backgroundColor: '#000000' },
  leak: { position: 'absolute', left: 0, right: 0 },
  piece: { position: 'absolute', borderRadius: 1.5 },
});
