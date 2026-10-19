/** 행 우선 3x3 회전 행렬. 화면 좌표계(x 오른쪽, y 아래, z 보는 사람 쪽)는 RN/CSS transform 과 같다. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** w, x, y, z. 기기 좌표계(x 오른쪽, y 위, z 화면 밖)에서 기기 → 세계 회전. */
export type Quat = [number, number, number, number];

export interface CardPose {
  /** RN transform 에 rotateX → rotateY → rotateZ 순서로 넣는 각도(deg). */
  rx: number;
  ry: number;
  rz: number;
  /** 앞면이 보는 사람 쪽을 향하는지. */
  facing: boolean;
}

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  'worklet';
  const r = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
}

export function rotX(deg: number): Mat3 {
  'worklet';
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

export function rotY(deg: number): Mat3 {
  'worklet';
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function quatMul(a: Quat, b: Quat): Quat {
  'worklet';
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

/**
 * 화면을 연 순간(q0)의 자세로 세계에 고정된 카드가 지금 자세(q)의 기기에서 어떻게 보이는지를 화면 좌표계 행렬로 낸다.
 * 기기 좌표계는 y 가 위라 화면 좌표계로 옮길 때 y 축을 뒤집는다.
 */
export function worldLockedCard(q0: Quat, q: Quat): Mat3 {
  'worklet';
  const [w, x, y, z] = quatMul([q[0], -q[1], -q[2], -q[3]], q0);
  return [
    1 - 2 * (y * y + z * z), -2 * (x * y - w * z), 2 * (x * z + w * y),
    -2 * (x * y + w * z), 1 - 2 * (x * x + z * z), -2 * (y * z - w * x),
    2 * (x * z - w * y), -2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

/** 센서 떨림만 걷어내는 정규화 선형 보간. 반대 반구의 같은 회전은 뒤집어 맞춘다. */
export function nlerp(a: Quat, b: Quat, t: number): Quat {
  'worklet';
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const r: Quat = [
    a[0] + (b[0] * sign - a[0]) * t,
    a[1] + (b[1] * sign - a[1]) * t,
    a[2] + (b[2] * sign - a[2]) * t,
    a[3] + (b[3] * sign - a[3]) * t,
  ];
  const n = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
  return [r[0] / n, r[1] / n, r[2] / n, r[3] / n];
}

/** M = Rx(rx)·Ry(ry)·Rz(rz) 로 분해한다. */
export function toPose(m: Mat3): CardPose {
  'worklet';
  const sy = Math.max(-1, Math.min(1, m[2]));
  const cy = Math.sqrt(1 - sy * sy);
  let rx: number;
  let rz: number;
  if (cy > 1e-5) {
    rx = Math.atan2(-m[5], m[8]);
    rz = Math.atan2(-m[1], m[0]);
  } else {
    rx = Math.atan2(m[7], m[4]);
    rz = 0;
  }
  const k = 180 / Math.PI;
  return { rx: rx * k, ry: Math.asin(sy) * k, rz: rz * k, facing: m[8] > 0 };
}
