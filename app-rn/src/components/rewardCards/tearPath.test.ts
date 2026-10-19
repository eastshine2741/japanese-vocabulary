import { describe, expect, it } from 'vitest';
import { bodyPath, edgePath, peelPath } from './tearPath';

const trail = [0, 20, 10, 24, 20, 18, 30, 22];

describe('tearPath', () => {
  it('손가락보다 오른쪽 점은 되돌아간 것이라 경로에서 뺀다', () => {
    expect(edgePath(trail, 15, 30)).toBe('M0 20L10 24L15 30');
  });

  it('몸통은 손가락 자리에서 위로 곧게 끊긴 뒤 나머지 테두리를 두른다', () => {
    const d = bodyPath(trail, 15, 30, 100, 200, 8);
    expect(d.startsWith('M0 20L10 24L15 30L15 0L92 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('끝까지 찢으면 윗변 없이 오른쪽 테두리로 바로 잇는다', () => {
    expect(bodyPath(trail, 100, 22, 100, 200, 8)).toContain('L30 22L100 22L100 192');
  });

  it('들리지 않은 조각은 찢긴 경로를 거꾸로 따라 닫힌다', () => {
    const { piece, edge } = peelPath(trail, 25, 21, 4, 0, 0);
    expect(edge).toBe('M25 21L20 18L10 24L0 20');
    expect(piece).toBe('M0 4Q0 0 4 0L25 0L25 21L20 18L10 24L0 20Z');
  });

  it('조각이 아직 모서리보다 작으면 그리지 않는다', () => {
    expect(peelPath(trail, 2, 21, 4, 0.1, 3).piece).toBe('M0 0');
  });
});
