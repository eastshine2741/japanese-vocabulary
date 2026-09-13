interface DragGesture {
  dx: number;
  dy: number;
}

const GESTURE_SLOP = 8;

function isVerticalGesture(gesture: DragGesture) {
  return Math.abs(gesture.dy) > Math.abs(gesture.dx);
}

export function shouldStackCaptureImmerseExit(immersed: boolean, gesture: DragGesture) {
  return immersed && gesture.dy > GESTURE_SLOP && isVerticalGesture(gesture);
}

export function shouldStartStackImmersePan(
  immersed: boolean,
  revealed: boolean,
  gesture: DragGesture,
) {
  if (shouldStackCaptureImmerseExit(immersed, gesture)) return true;
  return !immersed && !revealed && gesture.dy < -GESTURE_SLOP && isVerticalGesture(gesture);
}

export function shouldStartChromeImmersePan(immersed: boolean, gesture: DragGesture) {
  if (!isVerticalGesture(gesture)) return false;
  return immersed ? gesture.dy > GESTURE_SLOP : gesture.dy < -GESTURE_SLOP;
}
