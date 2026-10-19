/** 카드 모서리 반경 ÷ 카드 폭. SongCardShowcase 는 4.6u, ArtistCardShowcase 는 4u 다(u = 폭/100). */
export const CARD_CORNER = { song: 0.046, artist: 0.04 } as const;

const PANEL_W = 880;
const PAD = 44;
const AVATAR = 96;
const ICON = 76;
const HEADER_GAP = 32;
const FOOTER_GAP = 36;
const FOOTER_H = 76;
const CARD_MAX_H = 940;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** x 는 글자 상자 왼쪽(오른쪽 정렬이면 오른쪽 끝), y 는 위. */
interface TextSlot {
  x: number;
  y: number;
  size: number;
  width: number;
}

export interface StickerLayout {
  width: number;
  height: number;
  radius: number;
  avatar: Box;
  name: TextSlot;
  caption: TextSlot;
  icon: Box;
  card: Box;
  tagline: TextSlot;
  stores: TextSlot;
  brand: TextSlot;
  pitch: TextSlot;
}

/** 인스타 스토리 스티커. X 게시물 공유처럼 흰 패널에 주인 머리줄·카드·앱 이름 바닥줄을 담는다. 바탕은 인스타가 깐다. */
export function stickerLayout(cardW: number, cardH: number): StickerLayout {
  const inner = PANEL_W - PAD * 2;
  const scale = cardW > 0 && cardH > 0 ? Math.min(inner / cardW, CARD_MAX_H / cardH) : 0;
  const width = cardW * scale;
  const height = cardH * scale;
  const textX = PAD + AVATAR + 24;
  const textW = inner - AVATAR - 24 - ICON - 24;
  const cardY = PAD + AVATAR + HEADER_GAP;
  const footerY = cardY + height + FOOTER_GAP;
  return {
    width: PANEL_W,
    height: footerY + FOOTER_H + PAD,
    radius: 56,
    avatar: { x: PAD, y: PAD, width: AVATAR, height: AVATAR },
    name: { x: textX, y: PAD + 6, size: 40, width: textW },
    caption: { x: textX, y: PAD + 56, size: 28, width: textW },
    icon: { x: PANEL_W - PAD - ICON, y: PAD + (AVATAR - ICON) / 2, width: ICON, height: ICON },
    card: { x: (PANEL_W - width) / 2, y: cardY, width, height },
    tagline: { x: PAD, y: footerY, size: 28, width: inner * 0.66 },
    stores: { x: PAD, y: footerY + 42, size: 24, width: inner * 0.66 },
    brand: { x: PANEL_W - PAD, y: footerY - 6, size: 36, width: inner * 0.34 },
    pitch: { x: PANEL_W - PAD, y: footerY + 42, size: 24, width: inner * 0.34 },
  };
}

/** 링크 미리보기(og:image) 크기. X 큰 카드는 약 1.91:1 로 잘라서 세로 스토리 이미지를 쓰면 카드 가운데만 보인다. */
export const PREVIEW_W = 1200;
export const PREVIEW_H = 630;

const PREVIEW_CARD_MAX_H = PREVIEW_H * 0.86;

/** 캡처한 카드를 미리보기 가운데에 높이에 맞춰 놓는다. 제목은 미리보기 아래에 따로 붙어 글귀를 넣지 않는다. */
export function previewLayout(cardW: number, cardH: number): Box {
  const scale = cardW > 0 && cardH > 0 ? Math.min((PREVIEW_W * 0.9) / cardW, PREVIEW_CARD_MAX_H / cardH) : 0;
  const width = cardW * scale;
  const height = cardH * scale;
  return { x: (PREVIEW_W - width) / 2, y: (PREVIEW_H - height) / 2, width, height };
}
