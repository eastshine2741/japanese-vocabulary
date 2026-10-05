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

/** 상태바 아래로 드러나는 로딩 칸 높이. 놓았을 때 이만큼 드러나 있으면 새로고침이 걸린다. */
export const PULL_REFRESH_SLOT = 48;

/** 몰입 밖에서 아래로 끄는 세로 드래그 — 몰입 진입(위로)과 방향이 반대라 겹치지 않는다. */
export function shouldStartPullRefresh(immersed: boolean, gesture: DragGesture) {
  if (immersed) return false;
  if (Math.abs(gesture.dy) <= Math.abs(gesture.dx)) return false;
  return gesture.dy > GESTURE_SLOP;
}

/** 화면 전체가 내려가므로 상태바 높이만큼 더 내려가야 로딩 칸이 드러난다. */
export function pullRefreshThreshold(insetTop: number) {
  return insetTop + PULL_REFRESH_SLOT;
}

/** 손가락보다 덜 따라오게 저항을 걸고, 위로 되돌리면 0에서 멈춘다. */
export function pullRefreshDistance(dy: number, insetTop: number) {
  if (dy <= 0) return 0;
  // 문턱의 1.5배로 수렴해서, 상태바 높이와 무관하게 문턱까지 손가락은 약 1.65배를 끈다.
  const max = pullRefreshThreshold(insetTop) * 1.5;
  return max * (1 - Math.exp(-dy / max));
}
