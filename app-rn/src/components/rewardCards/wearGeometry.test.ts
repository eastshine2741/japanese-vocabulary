import { describe, expect, it } from 'vitest';
import { wearGeometry } from './wearGeometry';

describe('wearGeometry', () => {
  it('새 카드에는 손상이 없다', () => {
    const g = wearGeometry('a', 300, 419, 0);
    expect(g.creases).toHaveLength(0);
    expect(g.stain).toBeNull();
    expect(g.peels).toHaveLength(0);
    expect(g.rip).toBeNull();
    expect(g.edgeOpacity).toBe(0);
  });

  it('낡을수록 접힘 → 벗겨짐 → 찢어짐 순으로 손상이 붙는다', () => {
    const worn = wearGeometry('a', 300, 419, 0.45);
    expect(worn.creases.length).toBeGreaterThan(0);
    expect(worn.peels).toHaveLength(0);
    expect(worn.rip).toBeNull();

    const tattered = wearGeometry('a', 300, 419, 1);
    expect(tattered.creases).toHaveLength(3);
    expect(tattered.peels).toHaveLength(2);
    expect(tattered.rip).not.toBeNull();
  });

  it('같은 시드는 같은 자리에 같은 손상이 난다', () => {
    expect(wearGeometry('lemon', 300, 419, 0.7)).toEqual(wearGeometry('lemon', 300, 419, 0.7));
  });

  it('낡아 가도 이미 난 손상은 자리가 그대로다', () => {
    const early = wearGeometry('lemon', 300, 419, 0.5);
    const late = wearGeometry('lemon', 300, 419, 1);
    expect(late.creases[0].ridge).toBe(early.creases[0].ridge);
    expect(late.creases[1].ridge).toBe(early.creases[1].ridge);
    expect(late.stain?.blob).toBe(early.stain?.blob);
    expect(late.specks.slice(0, early.specks.length).map((s) => [s.r, s.o])).toEqual(early.specks.map((s) => [s.r, s.o]));
    expect(wearGeometry('lemon', 300, 419, 0.85).rip?.gap).toBe(late.rip?.gap);
  });

  it('앞뒷면은 접힘·찢어짐이 같고 얼룩·벗겨짐만 다르다', () => {
    const front = wearGeometry('lemon', 300, 419, 1, 'front');
    const back = wearGeometry('lemon', 300, 419, 1, 'back');
    expect(back.creases).toEqual(front.creases);
    expect(back.edge).toBe(front.edge);
    expect(back.rip?.gap).toBe(front.rip?.gap);
    expect(back.stain).not.toEqual(front.stain);
  });
});
