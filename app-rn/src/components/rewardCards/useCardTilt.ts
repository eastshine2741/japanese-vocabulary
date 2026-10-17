import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  DerivedValue,
  SensorType,
  SharedValue,
  useAnimatedReaction,
  useAnimatedSensor,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CardPose, IDENTITY, Mat3, Quat, mul, nlerp, rotX, rotY, toPose, worldLockedCard } from './cardPose';

// 눈은 폰과 같이 돌지 않아 1:1 로 반대로 돌리면 기울기가 두 배로 보인다. 일부만 돌리고 빛은 1:1 로 따라간다.
const CARD_FOLLOW = 0.35;
// 이 각도(deg)만큼 돌면 광택 효과가 끝까지 움직인다.
const EFFECT_FULL_X = Math.sin((16 * Math.PI) / 180);
const EFFECT_FULL_Y = Math.sin((12 * Math.PI) / 180);
const DRAG_MAX_Y = 16;
const DRAG_MAX_X = 12;
// 가로로 이만큼(px) 밀거나 이 속도(px/s)로 튕기고 놓으면 민 방향으로 뒤집힌다.
const FLIP_DISTANCE = 120;
const FLIP_VELOCITY = 900;
const FLIP_MS = 720;
const SMOOTH = 0.18;
// 들고 있는 자세가 바뀌면 몇 초에 걸쳐 그 자세를 새 정면으로 삼는다.
const RECENTER = 0.005;
const IS_ANDROID = Platform.OS === 'android';

// 인터페이스 방향 보정은 쿼터니언을 오일러각에서 다시 만들어 축 규약이 바뀌므로 끈다(앱은 세로 고정).
const useRotation = Platform.OS === 'web'
  ? () => null
  : () => useAnimatedSensor(SensorType.ROTATION, { interval: 16, adjustToInterfaceOrientation: false });

export interface CardTilt {
  /** 광택 효과용. -1(왼쪽) ~ 1(오른쪽). */
  x: DerivedValue<number>;
  /** 광택 효과용. -1(위) ~ 1(아래). */
  y: DerivedValue<number>;
  /** 0 = 앞면, 1 = 뒷면. */
  flip: SharedValue<number>;
  /** 켜면 기울기·드래그를 무시하고 정면으로 세운다. 공유 이미지 캡처용. */
  still: SharedValue<boolean>;
  /** 카드의 화면 속 회전. */
  pose: DerivedValue<CardPose>;
  gesture: ReturnType<typeof Gesture.Race>;
}

export function useCardTilt(): CardTilt {
  const flip = useSharedValue(0);
  const still = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const anchor = useSharedValue<Quat | null>(null);
  const device = useSharedValue<Quat | null>(null);
  const rotation = useRotation();

  useAnimatedReaction(
    () => (rotation ? rotation.sensor.value : null),
    (s) => {
      if (!s || !('qw' in s)) return;
      // Reanimated 는 Android 쿼터니언을 (qx, qz, -qy) 로 바꿔 내보낸다. 기기 축 그대로 되돌린다.
      const q: Quat = IS_ANDROID ? [s.qw, s.qx, -s.qz, s.qy] : [s.qw, s.qx, s.qy, s.qz];
      const n = Math.hypot(q[0], q[1], q[2], q[3]);
      if (n < 0.5) return;
      const unit: Quat = [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
      device.value = device.value ? nlerp(device.value, unit, SMOOTH) : unit;
      anchor.value = anchor.value ? nlerp(anchor.value, device.value, RECENTER) : unit;
    },
  );

  const world = useDerivedValue(() => {
    const m = anchor.value && device.value ? worldLockedCard(anchor.value, device.value) : IDENTITY;
    return { m, pose: toPose(m) };
  });

  // 드래그는 손가락으로 카드를 미는 것처럼 화면 축 기준으로 더한다. 화면 안 회전(rz)은 따라가지 않는다.
  const pose = useDerivedValue(() => {
    if (still.value) return toPose(rotY(flip.value * 180));
    const p = world.value.pose;
    const card = mul(rotX(p.rx * CARD_FOLLOW), rotY(p.ry * CARD_FOLLOW));
    return toPose(mul(mul(mul(rotX(dragX.value), rotY(dragY.value)), card), rotY(flip.value * 180)));
  });
  const light = useDerivedValue<Mat3>(() => mul(mul(rotX(dragX.value), rotY(dragY.value)), world.value.m));
  const x = useDerivedValue(() => Math.max(-1, Math.min(1, light.value[2] / EFFECT_FULL_X)));
  const y = useDerivedValue(() => Math.max(-1, Math.min(1, light.value[5] / EFFECT_FULL_Y)));

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onUpdate((e) => {
        dragY.value = Math.max(-1, Math.min(1, e.translationX / 140)) * DRAG_MAX_Y;
        dragX.value = -Math.max(-1, Math.min(1, e.translationY / 180)) * DRAG_MAX_X;
      })
      .onEnd((e) => {
        const fling = Math.abs(e.velocityX) > FLIP_VELOCITY;
        if (!fling && Math.abs(e.translationX) < FLIP_DISTANCE) return;
        const dir = Math.sign(fling ? e.velocityX : e.translationX);
        const from = Math.round(flip.value);
        // 왼쪽으로 넘기면 -1·2 를 거치게 해 미는 방향으로 돌고, 다 돌면 같은 모습인 0·1 로 되돌린다.
        const to = from + dir;
        flip.value = withTiming(to, { duration: FLIP_MS }, (finished) => {
          if (finished) flip.value = ((to % 2) + 2) % 2;
        });
      })
      .onFinalize(() => {
        dragX.value = withSpring(0, { damping: 12, stiffness: 90 });
        dragY.value = withSpring(0, { damping: 12, stiffness: 90 });
      });

    const tap = Gesture.Tap().onEnd(() => {
      flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_MS });
    });
    return Gesture.Race(pan, tap);
  }, [flip, dragX, dragY]);

  return { x, y, flip, still, pose, gesture };
}
