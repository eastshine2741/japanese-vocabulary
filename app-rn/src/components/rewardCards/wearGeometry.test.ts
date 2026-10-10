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

  it('앞뒷면은 접힘·찢어짐이 같고 얼룩·벗겨짐만 다르다', () => {
    const front = wearGeometry('lemon', 300, 419, 1, 'front');
    const back = wearGeometry('lemon', 300, 419, 1, 'back');
    expect(back.creases).toEqual(front.creases);
    expect(back.edge).toBe(front.edge);
    expect(back.rip?.gap).toBe(front.rip?.gap);
    expect(back.stain).not.toEqual(front.stain);
  });
});
