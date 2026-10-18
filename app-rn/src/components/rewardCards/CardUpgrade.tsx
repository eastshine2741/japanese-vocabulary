import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardSerial, SerialCount } from './CardSigner';
import CardSpreadLayer from './CardSpreadLayer';
import { hapticCrown, hapticGather, hapticHeartbeat, hapticRipple, hapticStamp } from './cardHaptics';
import { SHOWROOM, SHOWROOM_HEADING_TOP } from './cardTheme';
import { spreadReach } from './spreadLayer';
import { CardTilt } from './useCardTilt';

const RISE_AT_MS = 180;
/** 카드 전체를 먼저 보여 준 뒤 박힐 자리로 다가간다. */
const ZOOM_AT_MS = 1300;
const ZOOM_IN_MS = 1000;
const ZOOM = 2.4;
/** 기다리는 동안 박힐 자리에서 파동이 퍼지는 주기. */
const SONAR_MS = 1500;
/** 계속 울리면 성가셔서 몇 번만 두근거린다. */
const HEARTBEATS = 4;
const CHARGE_MS = 560;
const SHOCK_MS = 700;
/** 기다리는 동안 둘레를 누르는 정도. 숨을 모으면 끝까지 어두워진다. */
const SPOT_REST = 0.7;
/** 박힌 다이아와 충격파를 보여 준 뒤 번지기 시작한다. */
const STAMP_HOLD_MS = 700;
const SPREAD_MS = 1900;
/** 번지기 시작은 가까이서 보여 주고 조금 늦게 물러난다. */
const ZOOM_OUT_LAG_MS = 300;
const SPREAD_AT_MS = CHARGE_MS + STAMP_HOLD_MS;
const SETTLE_AT_MS = SPREAD_AT_MS + SPREAD_MS;
const COPY_AT_MS = SETTLE_AT_MS + 350;
const CTA_AT_MS = COPY_AT_MS + 650;
/** 제목이 떠오르는 걸 보고 순번을 세기 시작한다. */
const COUNT_AT_MS = COPY_AT_MS - SETTLE_AT_MS + 300;
const LIVE_FADE_MS = 320;
/** 카드 폭 대비 — 처음 박히는 자국의 반지름. */
const STAMP_R = 0.05;
const SETTLE = Easing.out(Easing.cubic);

export interface UpgradeMotion {
  rise: SharedValue<number>;
  /** 0→1 박힐 자리로 다가간 정도. */
  zoom: SharedValue<number>;
  /** 누른 순간 카드가 밀려 들어가는 힘. */
  press: SharedValue<number>;
  hint: SharedValue<number>;
  /** 0→1 반복, 박힐 자리에서 퍼지는 파동. */
  sonar: SharedValue<number>;
  /** 0→1 박힐 자리만 남기고 둘레를 어둡게 누른 정도. */
  spot: SharedValue<number>;
  /** 0 이면 아직 안 박혔다. 박힌 순간 1 을 넘었다가 1 로 돌아온다 — 자국이 튀어 나왔다 자리 잡는다. */
  stamp: SharedValue<number>;
  /** 0→1 박힌 자리에서 새 재질이 카드를 덮어 가는 진행. */
  spread: SharedValue<number>;
  shock: SharedValue<number>;
  /** 다 덮은 순간 카드가 한 번 부푸는 힘. */
  bump: SharedValue<number>;
  flash: SharedValue<number>;
  copyIn: SharedValue<number>;
  pulse: SharedValue<number>;
  ctaIn: SharedValue<number>;
  liveIn: SharedValue<number>;
  /** 다가가기가 끝나 누를 수 있다. */
  armed: boolean;
  opened: boolean;
  /** 기울기 효과가 있는 새 카드를 겹치기 시작했다. */
  live: boolean;
  /** 겹치기가 끝나 정적 카드를 뗐다. */
  settled: boolean;
  open: () => void;
}

/** 등급 오름 연출의 시간표. started 는 화면 전환이 끝났다는 신호다. */
export function useUpgradeMotion(started: boolean): UpgradeMotion {
  const [armed, setArmed] = useState(false);
  const [opened, setOpened] = useState(false);
  const [live, setLive] = useState(false);
  const [settled, setSettled] = useState(false);
  const rise = useSharedValue(0);
  const zoom = useSharedValue(0);
  const press = useSharedValue(0);
  const hint = useSharedValue(0);
  const sonar = useSharedValue(0);
  const spot = useSharedValue(0);
  const stamp = useSharedValue(0);
  const spread = useSharedValue(0);
  const shock = useSharedValue(0);
  const bump = useSharedValue(0);
  const flash = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const liveIn = useSharedValue(0);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!started) return;
    rise.value = withDelay(RISE_AT_MS, withTiming(1, { duration: 600, easing: SETTLE }));
    zoom.value = withDelay(
      ZOOM_AT_MS,
      withTiming(1, { duration: ZOOM_IN_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setArmed)(true);
      }),
    );
    spot.value = withDelay(ZOOM_AT_MS, withTiming(SPOT_REST, { duration: ZOOM_IN_MS, easing: Easing.inOut(Easing.cubic) }));
    hint.value = withDelay(
      ZOOM_AT_MS + ZOOM_IN_MS,
      withRepeat(withTiming(1, { duration: SONAR_MS / 2, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [started, rise, zoom, spot, hint, pulse]);

  useEffect(() => {
    if (!armed || opened) return;
    sonar.value = 0;
    sonar.value = withRepeat(withTiming(1, { duration: SONAR_MS, easing: Easing.out(Easing.quad) }), -1, false);
    hapticHeartbeat();
    let beats = 1;
    const timer = setInterval(() => {
      if (beats++ >= HEARTBEATS) return clearInterval(timer);
      hapticHeartbeat();
    }, SONAR_MS);
    return () => {
      clearInterval(timer);
      cancelAnimation(sonar);
    };
  }, [armed, opened, sonar]);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    hapticGather(CHARGE_MS);
    // 음수로 넘어가며 카드가 잠깐 튀어 오른다 — 내리친 반동.
    press.value = withSequence(
      withTiming(1, { duration: CHARGE_MS, easing: Easing.in(Easing.cubic) }),
      withTiming(-0.8, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 560, easing: SETTLE }),
    );
    stamp.value = withDelay(
      CHARGE_MS,
      withSequence(
        withTiming(1.7, { duration: 70, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) runOnJS(hapticStamp)();
        }),
        withTiming(1, { duration: 380, easing: SETTLE }),
      ),
    );
    shock.value = withDelay(CHARGE_MS, withTiming(1, { duration: SHOCK_MS, easing: Easing.out(Easing.cubic) }));
    spot.value = withSequence(
      withTiming(1, { duration: CHARGE_MS, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 700, easing: SETTLE }),
    );
    flash.value = withDelay(CHARGE_MS, withSequence(withTiming(0.95, { duration: 40 }), withTiming(0, { duration: 1000, easing: SETTLE })));
    const settle = () => {
      'worklet';
      bump.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 520, easing: SETTLE }),
      );
      runOnJS(hapticCrown)();
      runOnJS(setLive)(true);
    };
    spread.value = withDelay(
      SPREAD_AT_MS,
      withTiming(1, { duration: SPREAD_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) settle();
      }),
    );
    setTimeout(() => hapticRipple(SPREAD_MS), SPREAD_AT_MS);
    zoom.value = withDelay(
      SPREAD_AT_MS + ZOOM_OUT_LAG_MS,
      withTiming(0, { duration: SPREAD_MS - ZOOM_OUT_LAG_MS, easing: Easing.inOut(Easing.cubic) }),
    );
    copyIn.value = withDelay(COPY_AT_MS, withTiming(1, { duration: 560, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: 420, easing: SETTLE }));
  }, [press, stamp, shock, spot, flash, bump, spread, zoom, copyIn, ctaIn]);

  useEffect(() => {
    if (!live) return;
    liveIn.value = withTiming(1, { duration: LIVE_FADE_MS }, (finished) => {
      if (finished) runOnJS(setSettled)(true);
    });
  }, [live, liveIn]);

  return {
    rise,
    zoom,
    press,
    hint,
    sonar,
    spot,
    stamp,
    spread,
    shock,
    bump,
    flash,
    copyIn,
    pulse,
    ctaIn,
    liveIn,
    armed,
    opened,
    live,
    settled,
    open,
  };
}

interface Props {
  motion: UpgradeMotion;
  tilt: CardTilt;
  width: number;
  /** 세로 / 가로. */
  ratio: number;
  /** 모서리 반경, 카드 폭 비율. */
  radius: number;
  /** 지금 재질의 효과 없는 앞면. */
  before: React.ReactNode;
  /** 오른 재질의 효과 없는 앞면. */
  after: React.ReactNode;
  /** 새로 박히는 다이아·각인 자리. 여기서 새 재질이 번진다. */
  focus: { x: number; y: number };
  /** 다 번진 뒤 기울기 효과가 있는 카드. */
  showcase: React.ReactNode;
  /** 다 번진 뒤 카드 위 한 줄. */
  heading: string;
  /** 있으면 제목 아래 순번을 0 부터 세어 올린다. */
  serial?: CardSerial | null;
  /** 순번 숫자 색. */
  accent?: string;
  /** 승급 계단. 다 번지면 한 칸 오른다. */
  guide: React.ReactNode;
  onDone: () => void;
}

/**
 * 이미 가진 카드의 등급이 오를 때. 오른 이유(다이아·각인) 자리로 다가가 눌러 박으면, 거기서 새 재질이 카드 전체로 번진다.
 * 같은 카드가 바뀌는 것이라 봉투도 서명도 없다.
 */
export const CardUpgrade = React.memo(function CardUpgrade({
  motion,
  tilt,
  width,
  ratio,
  radius,
  before,
  after,
  focus,
  showcase,
  heading,
  serial = null,
  accent = SHOWROOM.fg,
  guide,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const { rise, zoom, press, hint, sonar, spot, stamp, spread, shock, bump, copyIn, ctaIn, liveIn, armed, opened, live, settled, open } =
    motion;
  const height = width * ratio;
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
  const [counting, setCounting] = useState(false);
  const handleCounted = useCallback(() => {}, []);
  useEffect(() => {
    if (!live || !serial) return;
    const timer = setTimeout(() => setCounting(true), COUNT_AT_MS);
    return () => clearTimeout(timer);
  }, [live, serial]);
  const reach = spreadReach(width, height, focus);
  const stampR = width * STAMP_R;
  const radiusPx = useDerivedValue(() => (stamp.value > 0 ? stampR * stamp.value + (reach - stampR) * spread.value : 0));

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(ready && armed && !opened)
        .onEnd(() => runOnJS(open)()),
    [ready, armed, opened, open],
  );

  // 박힐 자리를 축으로 키우고, 그 자리가 화면 가운데 오게 민다.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [
      { translateX: (width / 2 - focus.x) * zoom.value },
      { translateY: (height / 2 - focus.y) * zoom.value + (1 - rise.value) * 24 },
      { scale: (1 + (ZOOM - 1) * zoom.value) * (1 - 0.14 * press.value) * (1 + 0.035 * bump.value) },
    ],
  }));
  // 숨을 모으는 동안 빛이 박힐 자리로 모인다.
  const orbStyle = useAnimatedStyle(() => {
    const charge = Math.max(0, press.value);
    return { opacity: 0.85 * charge * (1 - Math.min(1, stamp.value)), transform: [{ scale: 1.8 - 1.1 * charge }] };
  });
  const sonarA = useAnimatedStyle(() => sonarRing(sonar.value, zoom.value));
  const sonarB = useAnimatedStyle(() => sonarRing((sonar.value + 0.5) % 1, zoom.value));
  const hintStyle = useAnimatedStyle(() => ({ opacity: zoom.value * (0.6 + 0.4 * hint.value) }));
  const liveStyle = useAnimatedStyle(() => ({ opacity: liveIn.value }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyIn.value,
    transform: [{ translateY: (1 - copyIn.value) * 10 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: (1 - ctaIn.value) * 20 }],
  }));
  const guideStyle = useAnimatedStyle(() => ({ opacity: rise.value * (1 - zoom.value) }));
  const target = stampR * 2.2;
  const targetBox = { width: target, height: target, borderRadius: target, left: focus.x - target / 2, top: focus.y - target / 2 };

  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.step, { paddingTop: insets.top + SHOWROOM_HEADING_TOP, paddingBottom: insets.bottom + 16 }]}>
      <Animated.View style={[styles.headingWrap, copyStyle]}>
        <Text style={styles.heading}>{heading}</Text>
        {serial && (
          <>
            <Text style={styles.serialLead}>{serial.lead}</Text>
            <SerialCount to={serial.no} tail={serial.tail} run={counting} color={accent} onDone={handleCounted} />
          </>
        )}
      </Animated.View>

      <View style={styles.stage}>
        <GestureDetector gesture={tap}>
          <Animated.View style={[{ width, height, transformOrigin: [focus.x, focus.y, 0] }, cardStyle]}>
            {!settled && (
              <View style={[styles.card, { borderRadius: width * radius }]}>
                <CardSpreadLayer
                  width={width}
                  height={height}
                  before={before}
                  after={after}
                  focus={focus}
                  spread={radiusPx}
                  spot={spot}
                  shock={shock}
                  stampR={stampR}
                  onReady={handleReady}
                />
              </View>
            )}
            {live && (
              <Animated.View style={[settled ? null : styles.over, liveStyle]}>
                <GestureDetector gesture={tilt.gesture}>
                  <View>{showcase}</View>
                </GestureDetector>
              </Animated.View>
            )}
            {armed && !opened && (
              <>
                <Animated.View pointerEvents="none" style={[styles.sonar, targetBox, sonarA]} />
                <Animated.View pointerEvents="none" style={[styles.sonar, targetBox, sonarB]} />
              </>
            )}
            {!live && <Animated.View pointerEvents="none" style={[styles.orb, targetBox, orbStyle]} />}
          </Animated.View>
        </GestureDetector>
      </View>

      {!opened && (
        <Animated.View pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + 40 }, hintStyle]}>
          <Text style={styles.hintText}>눌러서 새기기</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.guide, guideStyle]}>{guide}</Animated.View>

      <Animated.View pointerEvents={live ? 'auto' : 'none'} style={[styles.actions, ctaStyle]}>
        <Pressable onPress={onDone} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Text style={styles.ctaText}>확인</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

function sonarRing(t: number, zoom: number) {
  'worklet';
  return { opacity: zoom * 0.85 * (1 - t), transform: [{ scale: 1 + 4.5 * t }] };
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  headingWrap: { alignItems: 'center', paddingHorizontal: 24, gap: 6 },
  heading: { color: SHOWROOM.fg, fontSize: 20, fontWeight: '700' },
  serialLead: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', marginTop: 4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)' },
  over: { position: 'absolute', top: 0, left: 0 },
  sonar: { position: 'absolute', borderWidth: 1.5, borderColor: '#FFFFFF' },
  orb: { position: 'absolute', backgroundColor: '#FFFFFF', boxShadow: '0 0 18px 6px rgba(255, 255, 255, 0.85)' },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  guide: { alignItems: 'center', paddingHorizontal: 24, gap: 2 },
  actions: { paddingHorizontal: 24, paddingTop: 24 },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
