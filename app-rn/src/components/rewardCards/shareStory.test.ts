import { describe, expect, it } from 'vitest';
import { PREVIEW_H, PREVIEW_W, previewLayout, stickerLayout } from './shareStory';

describe('stickerLayout', () => {
  it.each([
    [840, 1260],
    [1200, 900],
    [300, 3000],
  ])('%ix%i 카드는 비율을 지킨 채 가로 가운데, 패널의 머리줄과 바닥줄 사이에 들어간다', (w, h) => {
    const l = stickerLayout(w, h);
    expect(l.card.width / l.card.height).toBeCloseTo(w / h);
    expect(l.card.x + l.card.width / 2).toBeCloseTo(l.width / 2);
    expect(l.card.x).toBeGreaterThan(0);
    expect(l.card.y).toBeGreaterThan(l.avatar.y + l.avatar.height);
    expect(l.card.y + l.card.height).toBeLessThan(l.tagline.y);
    expect(l.card.y + l.card.height).toBeLessThan(l.brand.y);
    expect(l.stores.y + l.stores.size * 1.4).toBeLessThan(l.height);
    expect(l.pitch.y + l.pitch.size * 1.4).toBeLessThan(l.height);
  });

  it('크기가 0 이면 카드를 그리지 않는다', () => {
    expect(stickerLayout(0, 0).card.width).toBe(0);
  });
});

describe('previewLayout', () => {
  it.each([
    [840, 1260],
    [1200, 900],
  ])('%ix%i 카드는 비율을 지킨 채 미리보기 안 가운데에 들어간다', (w, h) => {
    const card = previewLayout(w, h);
    expect(card.width / card.height).toBeCloseTo(w / h);
    expect(card.x + card.width / 2).toBeCloseTo(PREVIEW_W / 2);
    expect(card.y + card.height / 2).toBeCloseTo(PREVIEW_H / 2);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
  });
});
