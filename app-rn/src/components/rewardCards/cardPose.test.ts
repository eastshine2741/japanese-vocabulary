import { describe, expect, it } from 'vitest';
import { Mat3, Quat, mul, rotX, rotY, toPose, worldLockedCard } from './cardPose';

function axisQuat(axis: [number, number, number], deg: number): Quat {
  const h = (deg * Math.PI) / 360;
  return [Math.cos(h), axis[0] * Math.sin(h), axis[1] * Math.sin(h), axis[2] * Math.sin(h)];
}

const apply = (m: Mat3, v: [number, number, number]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

describe('worldLockedCard', () => {
  const start = axisQuat([1, 0, 0], 50);

  it('기기가 그대로면 카드는 화면을 정면으로 본다', () => {
    const p = toPose(worldLockedCard(start, start));
    expect(p.rx).toBeCloseTo(0);
    expect(p.ry).toBeCloseTo(0);
    expect(p.rz).toBeCloseTo(0);
    expect(p.facing).toBe(true);
  });

  it('폰 오른쪽을 멀어지게 돌리면 카드 오른쪽 모서리는 보는 사람 쪽으로 같은 각도만큼 온다', () => {
    const turned = mulQ(start, axisQuat([0, 1, 0], 20));
    const p = toPose(worldLockedCard(start, turned));
    expect(p.ry).toBeCloseTo(-20);
    expect(p.rx).toBeCloseTo(0);
    expect(apply(worldLockedCard(start, turned), [1, 0, 0])[2]).toBeGreaterThan(0);
  });

  it('폰 위쪽을 멀어지게 젖히면 카드 위쪽 모서리가 보는 사람 쪽으로 온다', () => {
    const turned = mulQ(start, axisQuat([1, 0, 0], -15));
    const m = worldLockedCard(start, turned);
    expect(toPose(m).rx).toBeCloseTo(-15);
    expect(apply(m, [0, -1, 0])[2]).toBeGreaterThan(0);
  });

  it('폰을 반시계로 돌리면 카드는 화면 속에서 시계 방향으로 같은 각도만큼 돈다', () => {
    const turned = mulQ(start, axisQuat([0, 0, 1], 30));
    expect(toPose(worldLockedCard(start, turned)).rz).toBeCloseTo(30);
  });

  it('90도 넘게 돌면 뒷면이 보인다', () => {
    const turned = mulQ(start, axisQuat([0, 1, 0], 120));
    expect(toPose(worldLockedCard(start, turned)).facing).toBe(false);
  });
});

describe('toPose', () => {
  it('Rx·Ry·Rz 각도를 되돌려 낸다', () => {
    const rz: Mat3 = [Math.cos(0.3), -Math.sin(0.3), 0, Math.sin(0.3), Math.cos(0.3), 0, 0, 0, 1];
    const p = toPose(mul(mul(rotX(25), rotY(-40)), rz));
    expect(p.rx).toBeCloseTo(25);
    expect(p.ry).toBeCloseTo(-40);
    expect(p.rz).toBeCloseTo((0.3 * 180) / Math.PI);
  });
});

function mulQ(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
