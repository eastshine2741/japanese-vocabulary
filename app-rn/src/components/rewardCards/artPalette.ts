export interface CardColors {
  accent: string;
  ink: string;
}

interface Oklch {
  L: number;
  C: number;
  h: number;
}

const BINS = 24;
// 이보다 무채색이면 색조가 없는 픽셀로 본다.
const NEUTRAL_C = 0.03;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch(r8: number, g8: number, b8: number): Oklch {
  const r = toLinear(r8 / 255);
  const g = toLinear(g8 / 255);
  const b = toLinear(b8 / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { L, C: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToLinear({ L, C, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const A = C * Math.cos(rad);
  const B = C * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** 밝기·색조는 지키고 sRGB 안에 들 때까지 채도만 깎는다. */
export function oklchToHex(color: Oklch): string {
  let lo = 0;
  let hi = color.C;
  if (!inGamut(oklchToLinear(color))) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...color, C: mid }))) lo = mid;
      else hi = mid;
    }
    color = { ...color, C: lo };
  }
  return `#${oklchToLinear(color)
    .map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

// 색조마다 채도를 가장 잘 담는 밝기가 달라 고정 밝기 하나로는 빨강은 연어색, 노랑은 겨자색이 된다.
const ACCENT_L: readonly [number, number][] = [[0, 0.72], [30, 0.7], [60, 0.76], [100, 0.87], [140, 0.82], [200, 0.8], [260, 0.72], [310, 0.72], [360, 0.72]];

function accentLightness(h: number): number {
  const i = ACCENT_L.findIndex(([hue]) => hue >= h);
  if (i <= 0) return ACCENT_L[0][1];
  const [h0, l0] = ACCENT_L[i - 1];
  const [h1, l1] = ACCENT_L[i];
  return l0 + ((l1 - l0) * (h - h0)) / (h1 - h0);
}

const binOf = (h: number) => Math.floor((h / 360) * BINS) % BINS;

function smoothedPeak(bins: Float64Array): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < BINS; i++) {
    const score = bins[(i + BINS - 1) % BINS] * 0.5 + bins[i] + bins[(i + 1) % BINS] * 0.5;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** 봉우리 칸과 양옆 칸 픽셀의 가중 평균 색조·채도. 색조는 원 위의 평균이다. */
function peakColor(pixels: Oklch[], peak: number, weight: (p: Oklch) => number): { h: number; C: number } {
  let x = 0;
  let y = 0;
  let c = 0;
  let w = 0;
  for (const p of pixels) {
    const d = (binOf(p.h) - peak + BINS) % BINS;
    if (d > 1 && d < BINS - 1) continue;
    const pw = weight(p);
    const rad = (p.h * Math.PI) / 180;
    x += Math.cos(rad) * pw;
    y += Math.sin(rad) * pw;
    c += p.C * pw;
    w += pw;
  }
  const h = (Math.atan2(y, x) * 180) / Math.PI;
  return { h: h < 0 ? h + 360 : h, C: w > 0 ? c / w : 0 };
}

/**
 * 아트 픽셀(RGBA)에서 카드 색을 뽑는다.
 * accent 는 가장 선명하게 눈에 띄는 색조, ink 는 가장 넓게 깔린 색조라 서로 다를 수 있다.
 * 밝기는 원본을 따르지 않고 고정한다 — ink 위 흰 제목과 accent 글씨가 어떤 아트에서도 읽혀야 한다.
 */
export function paletteFromPixels(rgba: ArrayLike<number>): CardColors | null {
  const pixels: Oklch[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    pixels.push(rgbToOklch(rgba[i], rgba[i + 1], rgba[i + 2]));
  }
  if (pixels.length === 0) return null;

  const vivid = new Float64Array(BINS);
  const area = new Float64Array(BINS);
  let colorful = 0;
  for (const p of pixels) {
    if (p.C < NEUTRAL_C) continue;
    colorful++;
    const bin = binOf(p.h);
    area[bin] += 1;
    // 너무 어둡거나 하얀 픽셀의 채도는 글씨 색으로 살렸을 때 원본과 달라 보인다.
    if (p.L >= 0.3 && p.L <= 0.95) vivid[bin] += p.C * p.C;
  }

  // 흑백에 가까운 아트는 억지로 색을 고르지 않고 따뜻한 회색으로 둔다.
  if (colorful < pixels.length * 0.04) {
    return { accent: oklchToHex({ L: 0.86, C: 0.012, h: 80 }), ink: oklchToHex({ L: 0.17, C: 0.004, h: 80 }) };
  }

  const vividTotal = vivid.reduce((a, b) => a + b, 0);
  const accentPeak = smoothedPeak(vividTotal > 0 ? vivid : area);
  const accent = peakColor(pixels, accentPeak, (p) => (p.C < NEUTRAL_C ? 0 : p.C * p.C));
  const base = peakColor(pixels, smoothedPeak(area), (p) => (p.C < NEUTRAL_C ? 0 : 1));

  return {
    accent: oklchToHex({ L: accentLightness(accent.h), C: Math.min(0.17, Math.max(0.09, accent.C * 1.15)), h: accent.h }),
    ink: oklchToHex({ L: 0.19, C: Math.min(0.035, base.C * 0.4), h: base.h }),
  };
}
