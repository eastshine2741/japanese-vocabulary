/** 인스타그램 스토리 크기(9:16). */
export const STORY_W = 1080;
export const STORY_H = 1920;

const CARD_MAX_W = STORY_W * 0.74;
// 하단 글귀 자리를 남긴다.
const CARD_MAX_H = STORY_H * 0.66;
const CARD_CENTER_Y = STORY_H * 0.45;

export interface StoryLayout {
  card: { x: number; y: number; width: number; height: number };
  appName: { y: number; size: number };
  url: { y: number; size: number };
}

/** 캡처한 카드(px)를 비율 그대로 스토리 가운데에 크게 놓는다. 글귀 y 는 글자 기준선이다. */
export function storyLayout(cardW: number, cardH: number): StoryLayout {
  const scale = cardW > 0 && cardH > 0 ? Math.min(CARD_MAX_W / cardW, CARD_MAX_H / cardH) : 0;
  const width = cardW * scale;
  const height = cardH * scale;
  return {
    card: { x: (STORY_W - width) / 2, y: CARD_CENTER_Y - height / 2, width, height },
    appName: { y: STORY_H - 190, size: 44 },
    url: { y: STORY_H - 130, size: 30 },
  };
}

/** 링크 미리보기(og:image) 크기. X 큰 카드는 약 1.91:1 로 잘라서 세로 스토리 이미지를 쓰면 카드 가운데만 보인다. */
export const PREVIEW_W = 1200;
export const PREVIEW_H = 630;

const PREVIEW_CARD_MAX_H = PREVIEW_H * 0.86;

/** 캡처한 카드를 미리보기 가운데에 높이에 맞춰 놓는다. 제목은 미리보기 아래에 따로 붙어 글귀를 넣지 않는다. */
export function previewLayout(cardW: number, cardH: number): StoryLayout['card'] {
  const scale = cardW > 0 && cardH > 0 ? Math.min((PREVIEW_W * 0.9) / cardW, PREVIEW_CARD_MAX_H / cardH) : 0;
  const width = cardW * scale;
  const height = cardH * scale;
  return { x: (PREVIEW_W - width) / 2, y: (PREVIEW_H - height) / 2, width, height };
}
