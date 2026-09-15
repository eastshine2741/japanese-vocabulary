import { AnalysisPillDock } from '../../utils/preferenceStorage';

interface DragGesture {
  dx: number;
  dy: number;
}

interface ReleaseGesture {
  /** 놓을 때까지 움직인 세로 거리(px). */
  dy: number;
  /** 놓는 순간의 세로 속도(px/ms). PanResponder 의 vy. */
  vy: number;
}

const GESTURE_SLOP = 8;
/** 이만큼만 끌어도 반대쪽으로 도킹된다. 이동 거리의 절반이 아니라 고정 거리라 가볍게 반응한다. */
const DOCK_DISTANCE = 48;
/** 거리가 짧아도 이 속도로 튕기면 반대쪽으로 도킹된다. */
const DOCK_VELOCITY = 0.3;

/** 세로 드래그만 잡는다 — 가로 흔들림이나 탭은 pill 의 onPress 로 남긴다. */
export function shouldStartDockPan(gesture: DragGesture) {
  return Math.abs(gesture.dy) > GESTURE_SLOP && Math.abs(gesture.dy) > Math.abs(gesture.dx);
}

/**
 * 놓았을 때의 도킹 위치. 반대쪽으로 짧게 끌거나 가볍게 튕기면 넘어가고,
 * 도킹된 쪽으로 움직였거나 거의 안 움직였으면 제자리다. travel 은 두 도킹 위치 사이 거리.
 */
export function pillDockAfterDrag(dock: AnalysisPillDock, gesture: ReleaseGesture, travel: number): AnalysisPillDock {
  if (travel <= 0) return dock;
  // 반대쪽을 향한 값이 양수가 되도록 부호를 맞춘다.
  const toward = dock === 'bottom' ? -1 : 1;
  const distance = gesture.dy * toward;
  const velocity = gesture.vy * toward;
  const threshold = Math.min(DOCK_DISTANCE, travel / 2);
  if (velocity < -DOCK_VELOCITY) return dock;
  if (distance >= threshold || velocity >= DOCK_VELOCITY) return dock === 'bottom' ? 'top' : 'bottom';
  return dock;
}
