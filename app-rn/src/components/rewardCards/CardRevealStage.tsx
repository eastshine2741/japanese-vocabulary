import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLand } from './cardHaptics';
import { SHOWROOM } from './cardTheme';
import { CardTilt } from './useCardTilt';

const CARD_AT_MS = 180;
/** 뒷면으로 떠올라 한 바퀴 반을 돌고 앞면에서 멈춘다. flip 1 = 180°. */
const SPIN_TURNS = 3;
const SPIN_MS = 1400;
const LAND_AT_MS = CARD_AT_MS + SPIN_MS - 120;
const COPY_AT_MS = LAND_AT_MS + 120;
const CTA_AT_MS = COPY_AT_MS + 260;
const LIVE_FADE_MS = 240;
const SETTLE = Easing.out(Easing.cubic);

export interface RevealMotion {
  rise: SharedValue<number>;
  flash: SharedValue<number>;
  ring: SharedValue<number>;
  pulse: SharedValue<number>;
  copyIn: SharedValue<number>;
  ctaIn: SharedValue<number>;
  spin: SharedValue<number>;
  liveIn: SharedValue<number>;
  /** 착지 연출이 끝나 기울기 효과가 있는 카드를 겹치기 시작했다. */
  live: boolean;
  /** 겹치기가 끝나 도는 정적 카드를 뗐다. */
  spinDone: boolean;
}

/**
 * 획득 연출의 시간표. 다른 단계로 갔다 돌아와도 다시 돌지 않게 흐름 쪽에서 한 번만 잡는다.
 * started 는 화면 전환이 끝났다는 신호다 — 전환과 회전이 겹치지 않게 그때 시작한다.
 */
export function useRevealMotion(started: boolean): RevealMotion {
  const [live, setLive] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const rise = useSharedValue(0);
  const flash = useSharedValue(0);
  const ring = useSharedValue(0);
  const pulse = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const spin = useSharedValue(SPIN_TURNS);
  const liveIn = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    rise.value = withDelay(CARD_AT_MS, withSpring(1, { damping: 15, stiffness: 90, mass: 1 }));
    spin.value = withDelay(CARD_AT_MS, withTiming(0, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }));
    flash.value = withDelay(
      LAND_AT_MS,
      withSequence(
        withTiming(1, { duration: 90 }, (finished) => {
          if (finished) runOnJS(hapticLand)();
        }),
        withTiming(0, { duration: 520, easing: SETTLE }),
      ),
    );
    ring.value = withDelay(
      LAND_AT_MS,
      withTiming(1, { duration: 900, easing: SETTLE }, (finished) => {
        if (finished) runOnJS(setLive)(true);
      }),
    );
    pulse.value = withDelay(LAND_AT_MS, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    copyIn.value = withDelay(COPY_AT_MS, withTiming(1, { duration: 420, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: 420, easing: SETTLE }));
  }, [started, rise, spin, flash, ring, pulse, copyIn, ctaIn]);

  useEffect(() => {
    if (!live) return;
    liveIn.value = withTiming(1, { duration: LIVE_FADE_MS }, (finished) => {
      if (finished) runOnJS(setSpinDone)(true);
    });
  }, [live, liveIn]);

  return { rise, flash, ring, pulse, copyIn, ctaIn, spin, liveIn, live, spinDone };
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
  motion: RevealMotion;
  children: React.ReactNode;
}

/** 흐린 아트 배경과 착지 섬광. 단계가 바뀌어도 그대로 남는다. */
export const RevealShell = React.memo(function RevealShell({ backdropUri, motion, children }: ShellProps) {
  const flashStyle = useAnimatedStyle(() => ({ opacity: 0.4 * motion.flash.value }));
  return (
    <View style={styles.root}>
      <Image source={{ uri: backdropUri }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}E0`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
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
  /** 도는 동안 쓰는 효과 없는 앞·뒷면. */
  front: React.ReactNode;
  back: React.ReactNode;
  /** 착지 뒤 기울기 효과가 있는 카드. */
  showcase: React.ReactNode;
  eyebrow: React.ReactNode;
  copy: React.ReactNode;
  actions: React.ReactNode;
}

/** 카드가 떠올라 돌다 내려앉는 첫 단계. */
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
  eyebrow,
  copy,
  actions,
}: IntroProps) {
  const insets = useSafeAreaInsets();
  const { rise, ring, pulse, copyIn, ctaIn, liveIn, live, spinDone } = motion;
  const height = width * ratio;

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.value * 2),
    transform: [{ translateY: (1 - rise.value) * 160 }, { scale: 0.55 + rise.value * 0.45 }],
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
      style={[styles.step, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
    >
      <Rise progress={copyIn} from={10} style={styles.eyebrow}>
        {eyebrow}
      </Rise>

      <View style={styles.stage}>
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
        <Animated.View style={cardStyle}>
          {!spinDone && <SpinCard width={width} height={height} radius={width * radius} front={front} back={back} spin={motion.spin} />}
          {live && (
            <Animated.View style={[spinDone ? null : styles.over, liveStyle]}>
              <GestureDetector gesture={tilt.gesture}>
                <View>{showcase}</View>
              </GestureDetector>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      <Rise progress={copyIn} from={14} style={styles.copy}>
        {copy}
      </Rise>

      <Rise progress={ctaIn} from={20} style={styles.actions}>
        {actions}
      </Rise>
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

interface ChipProps {
  colors: readonly [string, string, ...string[]];
  textColor: string;
  label: string;
  /** 라벨 앞에 붙는 등급 표시. */
  children?: React.ReactNode;
}

export const RevealChip = React.memo(function RevealChip({ colors, textColor, label, children }: ChipProps) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
      {children}
      <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
    </LinearGradient>
  );
});

interface CopyProps {
  title: string;
  titleFont: string;
  subtitle: string;
  accent: string;
}

export const RevealCopy = React.memo(function RevealCopy({ title, titleFont, subtitle, accent }: CopyProps) {
  return (
    <>
      <Text style={[styles.title, { fontFamily: titleFont }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.subtitle, { color: accent }]} numberOfLines={1}>{subtitle}</Text>
    </>
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

interface SpinCardProps {
  width: number;
  height: number;
  radius: number;
  front: React.ReactNode;
  back: React.ReactNode;
  /** 1 = 180°. 0 이면 앞면. */
  spin: SharedValue<number>;
}

/** 효과 레이어 없는 앞·뒷면을 텍스처로 한 번 그려 두고 회전만 바꾼다. */
const SpinCard = React.memo(function SpinCard({ width, height, radius, front, back, spin }: SpinCardProps) {
  const frontStyle = useAnimatedStyle(() => {
    const deg = spin.value * 180;
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0,
      transform: [{ perspective: 1100 }, { rotateY: `${deg}deg` }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = spin.value * 180;
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 0 : 1,
      transform: [{ perspective: 1100 }, { rotateY: `${deg + 180}deg` }],
    };
  });
  return (
    <View style={{ width, height }}>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.spinFace, { borderRadius: radius }, frontStyle]}>
        {front}
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.spinFace, { borderRadius: radius }, backStyle]}>
        {back}
      </Animated.View>
    </View>
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
  eyebrow: { alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2 },
  spinFace: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backfaceVisibility: 'hidden' },
  over: { position: 'absolute', top: 0, left: 0 },
  copy: { alignItems: 'center', paddingHorizontal: 32, gap: 4 },
  title: { color: SHOWROOM.fg, fontSize: 26 },
  subtitle: { fontSize: 14, fontWeight: '600' },
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
});
