import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  SensorType,
  SharedValue,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// 이 각도(정규화한 중력 벡터 성분)만큼 기울이면 끝까지 꺾인다.
const FULL_TILT = 0.32;
// 들고 있는 자세를 기준으로 삼되, 몇 초에 걸쳐 새 자세로 천천히 따라간다.
const RECENTER = 0.012;
const SMOOTH = 0.22;
// iOS 는 중력 축 부호가 Android 와 반대다.
const AXIS_SIGN = Platform.OS === 'ios' ? -1 : 1;

const useGravity = Platform.OS === 'web'
  ? () => null
  : () => useAnimatedSensor(SensorType.GRAVITY, { interval: 16 });

export interface CardTilt {
  /** -1(왼쪽) ~ 1(오른쪽). */
  x: SharedValue<number>;
  /** -1(위) ~ 1(아래). */
  y: SharedValue<number>;
  /** 0 = 앞면, 1 = 뒷면. */
  flip: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Race>;
}

export function useCardTilt(): CardTilt {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const flip = useSharedValue(0);
  const dragging = useSharedValue(false);
  const neutralX = useSharedValue(Number.NaN);
  const neutralY = useSharedValue(Number.NaN);
  const gravity = useGravity();

  useAnimatedReaction(
    () => (gravity ? gravity.sensor.value : null),
    (g) => {
      if (!g || !('x' in g)) return;
      const m = Math.hypot(g.x, g.y, g.z) || 1;
      const gx = (g.x / m) * AXIS_SIGN;
      const gy = (g.y / m) * AXIS_SIGN;
      if (Number.isNaN(neutralX.value)) {
        neutralX.value = gx;
        neutralY.value = gy;
      }
      neutralX.value += (gx - neutralX.value) * RECENTER;
      neutralY.value += (gy - neutralY.value) * RECENTER;
      if (dragging.value) return;
      const tx = Math.max(-1, Math.min(1, -(gx - neutralX.value) / FULL_TILT));
      const ty = Math.max(-1, Math.min(1, (gy - neutralY.value) / FULL_TILT));
      x.value += (tx - x.value) * SMOOTH;
      y.value += (ty - y.value) * SMOOTH;
    },
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onBegin(() => {
        dragging.value = true;
      })
      .onUpdate((e) => {
        x.value = Math.max(-1, Math.min(1, e.translationX / 140));
        y.value = Math.max(-1, Math.min(1, e.translationY / 180));
      })
      .onFinalize(() => {
        dragging.value = false;
        x.value = withSpring(0, { damping: 12, stiffness: 90 });
        y.value = withSpring(0, { damping: 12, stiffness: 90 });
      });

    const tap = Gesture.Tap().onEnd(() => {
      flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: 720 });
    });
    return Gesture.Race(pan, tap);
  }, [x, y, flip, dragging]);

  return { x, y, flip, gesture };
}
