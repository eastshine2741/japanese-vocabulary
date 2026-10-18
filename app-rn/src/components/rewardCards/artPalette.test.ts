import { describe, expect, it } from 'vitest';
import { backdropFromPixels, oklchToHex, paletteFromPixels } from './artPalette';

function image(...parts: [count: number, rgb: [number, number, number]][]): number[] {
  return parts.flatMap(([count, rgb]) => Array.from({ length: count }, () => [...rgb, 255]).flat());
}

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const luma = (s: string) => {
  const [r, g, b] = hex(s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('paletteFromPixels', () => {
  it('빨간 아트는 빨간 강조색과 붉은 기 도는 어두운 바탕', () => {
    const colors = paletteFromPixels(image([100, [220, 40, 40]]))!;
    const [r, g, b] = hex(colors.accent);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    const [ir, ig, ib] = hex(colors.ink);
    expect(ir).toBeGreaterThanOrEqual(ig);
    expect(ir).toBeGreaterThanOrEqual(ib);
  });

  it('넓은 남색 배경 위 작은 주황은 강조색이 주황, 바탕이 남색', () => {
    const colors = paletteFromPixels(image([800, [20, 30, 80]], [120, [250, 140, 30]], [80, [200, 200, 200]]))!;
    const [r, , b] = hex(colors.accent);
    expect(r).toBeGreaterThan(b);
    const [ir, , ib] = hex(colors.ink);
    expect(ib).toBeGreaterThan(ir);
  });

  it('흑백 아트는 색을 지어내지 않는다', () => {
    const colors = paletteFromPixels(image([500, [30, 30, 30]], [500, [230, 230, 230]]))!;
    for (const c of [colors.accent, colors.ink]) {
      const [r, g, b] = hex(c);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20);
    }
  });

  it('어떤 아트든 강조색은 밝고 바탕은 어둡다', () => {
    for (const rgb of [[255, 240, 0], [0, 0, 255], [120, 0, 160], [0, 90, 40], [250, 250, 240]] as const) {
      const colors = paletteFromPixels(image([100, [...rgb]]))!;
      expect(luma(colors.accent)).toBeGreaterThan(150);
      expect(luma(colors.ink)).toBeLessThan(40);
    }
  });

  it('투명한 픽셀뿐이면 null', () => {
    expect(paletteFromPixels([10, 20, 30, 0])).toBeNull();
  });
});

describe('oklchToHex', () => {
  it('sRGB 밖의 채도는 깎는다', () => {
    expect(oklchToHex({ L: 0.8, C: 0.4, h: 264 })).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('backdropFromPixels', () => {
  const contrastWithWhite = (s: string) => {
    const [r, g, b] = hex(s).map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
  };

  it('넓은 남색과 그다음 주황은 남색 → 주황 두 색', () => {
    const [first, second] = backdropFromPixels(image([700, [20, 30, 120]], [300, [250, 140, 30]]))!;
    const [fr, , fb] = hex(first);
    expect(fb).toBeGreaterThan(fr);
    const [sr, , sb] = hex(second);
    expect(sr).toBeGreaterThan(sb);
  });

  it('한 색조뿐인 아트도 서로 다른 두 색을 낸다', () => {
    const [first, second] = backdropFromPixels(image([100, [220, 40, 40]]))!;
    expect(first).not.toBe(second);
  });

  it('밝은 노랑 아트에서도 흰 글자가 읽힌다', () => {
    for (const c of backdropFromPixels(image([600, [250, 230, 60]], [400, [120, 230, 90]]))!) {
      expect(contrastWithWhite(c)).toBeGreaterThan(4.5);
    }
  });

  it('흑백 아트는 색을 지어내지 않는다', () => {
    for (const c of backdropFromPixels(image([500, [30, 30, 30]], [500, [230, 230, 230]]))!) {
      const [r, g, b] = hex(c);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20);
    }
  });
});
