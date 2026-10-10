import type { ArtistGrade } from './artistGrade';

/** Skia ColorMatrix 순서의 4×5 행렬. 오프셋은 0–1 범위. */
export type ColorMatrix = readonly number[];

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/**
 * 인화 마감. 대비 c 는 중간 회색을 축으로 걸고, lift 만큼 검정을 띄운다(무광 인화처럼 부드러워진다).
 * 채도 s 는 1 이 원본. 색조는 건드리지 않는다.
 */
function finish(c: number, lift: number, s = 1): ColorMatrix {
  const a = 1 - s;
  const k = c * (1 - lift);
  const o = ((1 - c) / 2) * (1 - lift) + lift;
  return [
    (a * LR + s) * k, a * LG * k, a * LB * k, 0, o,
    a * LR * k, (a * LG + s) * k, a * LB * k, 0, o,
    a * LR * k, a * LG * k, (a * LB + s) * k, 0, o,
    0, 0, 0, 1, 0,
  ];
}

// 사진 색은 모든 재질이 같다. 색을 깎거나 금속 색을 덧칠하면 바래 보여서, 등급은 무광 → 유광 인화 마감으로만 오른다.
export const ARTIST_PHOTO_TONE: Record<ArtistGrade, ColorMatrix> = {
  paper: finish(0.9, 0.06),
  bronze: finish(0.98, 0.035),
  silver: finish(1.02, 0.02),
  gold: finish(1.07, 0),
  platinum: finish(1.1, 0, 1.04),
  diamond: finish(1.13, 0, 1.08),
};

/** 웹(개발용)은 CSS 필터로 비슷하게만 맞춘다. */
export const ARTIST_PHOTO_CSS: Record<ArtistGrade, string> = {
  paper: 'contrast(0.9) brightness(1.04)',
  bronze: 'contrast(0.98) brightness(1.02)',
  silver: 'contrast(1.02)',
  gold: 'contrast(1.07)',
  platinum: 'contrast(1.1) saturate(1.04)',
  diamond: 'contrast(1.13) saturate(1.08)',
};

export function applyColorMatrix(m: ColorMatrix, [r, g, b]: readonly [number, number, number]): [number, number, number] {
  const ch = (i: number) => m[i * 5] * r + m[i * 5 + 1] * g + m[i * 5 + 2] * b + m[i * 5 + 4];
  return [ch(0), ch(1), ch(2)];
}
