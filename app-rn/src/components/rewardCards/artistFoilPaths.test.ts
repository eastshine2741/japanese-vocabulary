import { describe, expect, it } from 'vitest';
import { guillochePath, rosettePath } from './artistFoilPaths';

const coords = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('guillochePath', () => {
  it('두 물결 묶음의 선 18개가 카드 폭을 가로지른다', () => {
    const d = guillochePath(300, 190, 95);
    expect(d.match(/M/g)).toHaveLength(18);
    const xs = coords(d).filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(300, 0);
  });

  it('물결은 시작 높이 언저리부터 카드 아래까지만 깔린다', () => {
    const ys = coords(guillochePath(300, 190, 95)).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(95 - 95 * 0.16 * 1.5);
    expect(Math.max(...ys)).toBeLessThan(190 + 95 * 0.16 * 1.5);
  });
});

describe('rosettePath', () => {
  it('바깥 고리가 카드 네 귀퉁이까지 닿는다', () => {
    const d = rosettePath(300, 190, 234, 61);
    const c = coords(d);
    const xs = c.filter((_, i) => i % 2 === 0);
    const ys = c.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(190);
    expect(d.match(/M/g)).toHaveLength(18);
  });
});
