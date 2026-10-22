import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hapticsEnabled } from '../../stores/hapticStore';
import { Pulse, toPattern } from './vibrationPattern';

// 웹·진동 없는 기기에선 조용히 넘어간다.
const run = (fire: () => Promise<void>) => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  fire().catch(() => {});
};

/** 큰 순간의 패턴이 끝나는 시각. 그 전엔 작은 진동이 끼어들어 패턴을 끊지 않게 넘긴다. */
let strongUntil = 0;

const impact = (style: Haptics.ImpactFeedbackStyle) => {
  if (Date.now() < strongUntil) return;
  run(() => Haptics.impactAsync(style));
};

type Beat = [number, Haptics.ImpactFeedbackStyle];
const { Light, Medium, Heavy, Rigid } = Haptics.ImpactFeedbackStyle;
const play = (beats: Beat[]) => beats.forEach(([at, style]) => setTimeout(() => impact(style), at));

/**
 * 큰 순간의 진동. 안드로이드 impact 는 Heavy 도 진폭 70/255 이고 다음 진동이 앞 진동을 끊어서,
 * 기기 기본 세기의 패턴 하나로 몰아 친다. 세기는 고정이라 강약은 울림 길이로 낸다.
 */
const strong = (android: Pulse[], ios: Beat[]) => {
  if (!hapticsEnabled()) return;
  if (Platform.OS === 'android') {
    const pattern = toPattern(android);
    strongUntil = Date.now() + pattern.reduce((sum, ms) => sum + ms, 0);
    return Vibration.vibrate(pattern);
  }
  play(ios);
};

const success = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** 봉투 띠를 뜯는 동안 한 칸마다. 끝에 가까울수록 세게. */
export const hapticTear = (progress: number) =>
  impact(progress < 0.5 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);

const CHARGE_BEATS = [0, 0.3, 0.52, 0.68, 0.8, 0.89, 0.95];

/** 터지기 직전 숨을 모으는 동안 — 두두두 점점 빠르고 세게 몰아친다. */
export const hapticCharge = (ms: number) =>
  strong(
    CHARGE_BEATS.map((t, i) => [t * ms, 12 + 6 * i]),
    CHARGE_BEATS.map((t, i) => [t * ms, i < 2 ? Light : i < 5 ? Medium : Heavy]),
  );

/** 봉투가 터지는 순간·서명한 카드가 뒤집히는 순간 — 무거운 두 방. 성공 진동은 제자리에 박힐 때 준다. */
export const hapticBurst = () =>
  strong(
    [
      [0, 90],
      [150, 120],
    ],
    [
      [0, Heavy],
      [80, Heavy],
    ],
  );

/** 도는 카드의 옆면이 지날 때. 멈출 무렵엔 조금 세게. */
export const hapticSpin = (progress: number) =>
  impact(progress < 0.7 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);

/** 다 돈 카드·올라가던 순번이 제자리에 박히는 순간 — 무거운 두 방에 성공 진동. */
export const hapticSettle = () => {
  strong(
    [
      [0, 80],
      [130, 80],
    ],
    [
      [0, Heavy],
      [60, Heavy],
    ],
  );
  // 안드로이드 성공 진동도 패턴이라 앞 패턴이 끝난 뒤에 울린다.
  setTimeout(success, Platform.OS === 'android' ? 260 : 140);
};

/** 승급 계단이 한 칸 찰 때. 지금 자리에 닿으면 조금 세게. */
export const hapticRung = (last: boolean) =>
  impact(last ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

/** 서명을 확정할 때. */
export const hapticSign = () => impact(Haptics.ImpactFeedbackStyle.Light);

/** 획득 순번이 올라가는 동안 숫자가 바뀔 때마다. */
export const hapticCount = () => run(() => Haptics.selectionAsync());

/** 박힐 자리에서 기다리는 동안 퍼지는 파동마다 — 크게 두-근. */
export const hapticHeartbeat = () =>
  strong(
    [
      [0, 70],
      [180, 45],
    ],
    [
      [0, Heavy],
      [40, Rigid],
      [170, Heavy],
    ],
  );

const GATHER_BEATS = 18;

/** 등급을 박기 전 숨을 모으는 동안 — 간격이 점점 좁아지고 세지다가, 내리치기 직전 한 박자 숨을 멈춘다. */
export const hapticGather = (ms: number) => {
  const end = ms * 0.86;
  const at = (i: number) => (1 - (1 - i / GATHER_BEATS) ** 2.2) * end;
  const beats = Array.from({ length: GATHER_BEATS }, (_, i) => i);
  strong(
    beats.map((i) => [at(i), Math.min(10 + 2 * i, end - at(i))]),
    beats.map((i) => [at(i), i < 4 ? Light : i < 9 ? Medium : i < 14 ? Heavy : Rigid]),
  );
};

/** 등급을 박는 순간 — 무거운 연타가 한 덩어리로 내리치고, 사이를 두고 여진이 잦아든다. */
export const hapticStamp = () =>
  strong(
    [
      [0, 220],
      [330, 90],
      [530, 55],
      [705, 30],
    ],
    [
      [0, Heavy],
      [25, Heavy],
      [50, Rigid],
      [75, Heavy],
      [100, Rigid],
      [130, Heavy],
      [300, Heavy],
      [440, Medium],
      [560, Medium],
      [660, Light],
    ],
  );

const RIPPLE_BEATS = 16;

/** 박힌 자리에서 새 등급이 번져 나가는 동안 — 처음엔 두 겹으로 촘촘하고 세게, 퍼질수록 띄엄띄엄 약하게. */
export const hapticRipple = (ms: number) => {
  const at = (i: number) => (i / RIPPLE_BEATS) ** 1.8 * ms;
  const pulses: Pulse[] = [];
  const beats: Beat[] = [];
  for (let i = 0; i < RIPPLE_BEATS; i++) {
    pulses.push([at(i), Math.round(70 * (1 - i / RIPPLE_BEATS)) + 12]);
    beats.push([at(i), i < 4 ? Heavy : i < 9 ? Medium : Light]);
    if (i < 6) beats.push([at(i) + 35, i < 3 ? Rigid : Medium]);
  }
  strong(pulses, beats);
};

/** 새 등급이 카드를 다 덮은 순간 — 연타로 내리친 뒤 한 번 더, 그리고 성공 진동. */
export const hapticCrown = () => {
  strong(
    [
      [0, 130],
      [210, 160],
    ],
    [
      [0, Heavy],
      [35, Rigid],
      [70, Heavy],
      [220, Heavy],
    ],
  );
  setTimeout(success, Platform.OS === 'android' ? 440 : 340);
};
