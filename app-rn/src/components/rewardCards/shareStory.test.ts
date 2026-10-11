import { describe, expect, it } from 'vitest';
import { PREVIEW_H, PREVIEW_W, STORY_H, STORY_W, previewLayout, storyLayout } from './shareStory';

describe('storyLayout', () => {
  it.each([
    [840, 1260],
    [1200, 900],
    [300, 3000],
  ])('%ix%i 카드는 비율을 지킨 채 가로 가운데, 글귀 위에 들어간다', (w, h) => {
    const { card, appName } = storyLayout(w, h);
    expect(card.width / card.height).toBeCloseTo(w / h);
    expect(card.x + card.width / 2).toBeCloseTo(STORY_W / 2);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThan(appName.y - appName.size);
    expect(appName.y).toBeLessThan(STORY_H);
  });

  it('크기가 0 이면 카드를 그리지 않는다', () => {
    expect(storyLayout(0, 0).card.width).toBe(0);
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
