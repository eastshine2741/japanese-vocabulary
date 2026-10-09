import { CelebrationPalette as P } from './palette';

/**
 * 불꽃이 살아 있게 하는 시계. 모든 주파수가 이 길이 안에서 정수 바퀴를 돌아야 반복 경계에서 튀지 않는다.
 * 축하 화면과 연속 학습 히어로가 같은 시계를 쓴다.
 */
export const FIRE_LOOP_MS = 12000;

/**
 * 바깥에서 안으로 갈수록 뜨거운 3겹. 셋이 같은 일렁임을 타되 안쪽이 조금 늦게 따라와,
 * 밑동은 붙어 있고 끝만 너울거리는 한 덩어리 불로 보이게 한다.
 * catchAt 은 점화 구간으로, 속불부터 밑동에서 위로 솟으며 바깥으로 번진다.
 */
export const FLAME_LAYERS = [
  { color: P.flameOuter, ratio: 1, top: 0, stretch: 0.05, sway: 1.5, lag: 0, catchAt: [0.2, 0.6] },
  { color: P.flameMid, ratio: 0.84, top: 0.2, stretch: 0.07, sway: 2, lag: 0.012, catchAt: [0.1, 0.45] },
  { color: P.flameCore, ratio: 0.44, top: 0.5, stretch: 0.09, sway: 2.5, lag: 0.024, catchAt: [0, 0.3] },
] as const;

/** 불꽃 속에서 천천히 솟아오르는 불씨. cycles 는 FIRE_LOOP 당 횟수. */
export const EMBERS = [
  { cycles: 4, offset: 0, dx: -0.12, size: 0.022 },
  { cycles: 5, offset: 0.45, dx: 0.1, size: 0.018 },
  { cycles: 6, offset: 0.2, dx: -0.02, size: 0.025 },
  { cycles: 5, offset: 0.75, dx: 0.16, size: 0.016 },
] as const;

/** 느린 너울(약 1Hz)에 잔떨림(약 2.6Hz)을 조금 얹은 -1~1. */
export function lift(t: number, lag: number): number {
  'worklet';
  const u = t - lag;
  return Math.sin(2 * Math.PI * u * 13) * 0.75 + Math.sin(2 * Math.PI * (u * 31 + 0.3)) * 0.25;
}

/** 좌우 기울기는 더 느리게(약 0.6Hz) 돈다. */
export function lean(t: number, lag: number): number {
  'worklet';
  return Math.sin(2 * Math.PI * ((t - lag) * 7 + 0.15));
}
