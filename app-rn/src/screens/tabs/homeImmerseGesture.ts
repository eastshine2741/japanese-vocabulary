interface DragGesture {
  dx: number;
  dy: number;
}

/** 헤더가 완전히 접히는 드래그 거리. 손가락이 이 구간을 그대로 끌고 간다. */
export const IMMERSE_DISTANCE = 120;
const GESTURE_SLOP = 8;

/** 세로 드래그만 잡는다 — 몰입 중엔 아래로, 아니면 위로. */
export function shouldStartImmersePan(immersed: boolean, gesture: DragGesture) {
  if (Math.abs(gesture.dy) <= Math.abs(gesture.dx)) return false;
  return immersed ? gesture.dy > GESTURE_SLOP : gesture.dy < -GESTURE_SLOP;
}

/** 지금 상태를 기준점으로 손가락이 끈 만큼의 몰입 값. 반대 방향은 clamp 에 먹힌다. */
export function immerseProgress(immersed: boolean, dy: number) {
  const base = immersed ? 1 : 0;
  return Math.min(1, Math.max(0, base - dy / IMMERSE_DISTANCE));
}
