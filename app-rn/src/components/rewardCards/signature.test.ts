import { describe, expect, it } from 'vitest';
import { shouldAddPoint, strokePath, toSignaturePoint } from './signature';

describe('toSignaturePoint', () => {
  it('패드 폭을 서명 좌표계 폭으로 늘린다', () => {
    expect(toSignaturePoint(90, 30, 180)).toEqual({ x: 180, y: 60 });
  });

  it('칸 밖으로 끌고 나간 점은 가장자리에 붙인다', () => {
    expect(toSignaturePoint(-10, 500, 360)).toEqual({ x: 0, y: 120 });
  });
});

describe('shouldAddPoint', () => {
  it('첫 점은 늘 더하고, 직전 점과 너무 가까우면 버린다', () => {
    expect(shouldAddPoint([], { x: 0, y: 0 })).toBe(true);
    expect(shouldAddPoint([{ x: 0, y: 0 }], { x: 1, y: 0 })).toBe(false);
    expect(shouldAddPoint([{ x: 0, y: 0 }], { x: 2, y: 0 })).toBe(true);
  });
});

describe('strokePath', () => {
  it('점이 없으면 빈 경로', () => {
    expect(strokePath([])).toBe('');
  });

  it('점 하나는 점으로 보이게 아주 짧은 선을 긋는다', () => {
    expect(strokePath([{ x: 10, y: 20 }])).toBe('M10 20 L10.1 20');
  });

  it('두 점은 직선', () => {
    expect(strokePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M0 0 L10 5');
  });

  it('가운데 점들은 다음 점과의 중점으로 곡선을 잇는다', () => {
    expect(strokePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }])).toBe('M0 0 Q10 0 15 5 L20 10');
  });
});
