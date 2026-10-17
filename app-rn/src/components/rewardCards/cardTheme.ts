import type { ArtistGrade } from './artistGrade';
import { CardLevel } from './types';

export const CARD_RATIO = 88 / 63;
export const ARTIST_CARD_RATIO = 54 / 85.6;

interface LevelMaterial {
  frame: readonly [string, string, ...string[]];
  pip: string;
  chipText: string;
  /** 종이 결 세기. 금속 테가 없는 기본 카드만 무광 종이로 찍는다. */
  matte: number;
  /** 정보 칸에 곡 강조색 빛을 깐다. */
  tint: boolean;
  /** 제목에 찍는 박. */
  foil: readonly [string, string, ...string[]] | null;
  /** 앞면 세로 가사까지 박으로 찍는다. */
  foilLyrics: boolean;
  /** 뒷면 몸체. 앞면 테와 같은 등급 색으로, 글씨가 읽히게 명암 띠만 누그러뜨렸다. 글씨는 chipText. */
  body: readonly [string, string, ...string[]];
  /** 기울이지 않는 썸네일에 멈춰 보이는 포일 가루. */
  restSparkles: number;
  gloss: number;
}

const BRONZE_FOIL = ['#7A3F1E', '#D9956A', '#FFE6D0', '#B06E45', '#F0C29E'] as const;
const SILVER_FOIL = ['#6F7784', '#E4E8EE', '#FFFFFF', '#98A1AE', '#DCE1E8'] as const;
const GOLD_FOIL = ['#8A5E12', '#E0B04A', '#FFF5D6', '#B8862C', '#F4D688'] as const;
const PLAIN = { matte: 0, tint: true, foil: null, foilLyrics: false, restSparkles: 0, gloss: 1 };

export const LEVEL_MATERIAL: Record<CardLevel, LevelMaterial> = {
  // 아티스트 등급처럼 종이 → 동 → 은 → 금. 박이 차지하는 자리는 제목 → 가사 → 아트 전체로 넓어진다.
  0: {
    ...PLAIN,
    frame: ['#BDB6A8', '#B1AA9C', '#B8B1A3'],
    body: ['#C2BBAD', '#B6AFA1', '#BEB7A9'],
    pip: '#A8A194',
    chipText: '#2E2A22',
    matte: 0.55,
    tint: false,
    gloss: 0.25,
  },
  1: {
    ...PLAIN,
    frame: ['#EDBB92', '#8A4E2B', '#F6D0AC', '#6E3B1E', '#D99A6B'],
    body: ['#E9B88F', '#C68A5F', '#F1CBA8', '#BF8259'],
    pip: '#F0C29E',
    chipText: '#2E1608',
    foil: BRONZE_FOIL,
  },
  2: {
    ...PLAIN,
    frame: ['#E6E9EF', '#8A93A3', '#F7F8FB', '#7D8698', '#E9ECF2'],
    body: ['#E4E8EE', '#C3CAD4', '#EEF1F5', '#CDD3DC'],
    pip: '#E7EBF2',
    chipText: '#1C2230',
    foil: SILVER_FOIL,
    foilLyrics: true,
  },
  3: {
    ...PLAIN,
    frame: ['#FBE7A6', '#B8862C', '#FFF4C9', '#9C6C1E', '#F6DC8E'],
    body: ['#F6E2A4', '#D8B262', '#FAEBC0', '#CFA852'],
    pip: '#F6DC8E',
    chipText: '#3B2A00',
    foil: GOLD_FOIL,
    foilLyrics: true,
    restSparkles: 5,
    gloss: 1.15,
  },
};

export { SONG_MASTER_NAME, SONG_TIER_NAME, songTierName } from './cardKinds';

/** 마스터 카드는 완곡 금색 대신 푸른 다이아로 레벨을 찍는다. */
export const MASTER_PIP = '#7CC8FF';

/** 마스터 칩. 완곡 금색 칩과 갈리도록 카드에 박힌 다이아의 하늘색 면으로 칠한다. */
export const MASTER_CHIP = {
  frame: ['#D6EFFF', MASTER_PIP, '#F2FAFF', '#3D8FDB', '#CBE9FF'],
  chipText: '#0B2A55',
} as const;

interface ArtistMaterial {
  /** 앞면 둘레 금속 모서리와 화면 등급 칩에 쓰는 등급 색. */
  frame: readonly [string, string, ...string[]];
  chipText: string;
  /** 앞면 등급 각인과 뒷면 숫자에 찍는 박. 진한 색과 거의 흰색이 번갈아야 금속으로 보인다. 컬러 사진 위 이름에 박을 쓰면 색끼리 부딪혀 이름은 늘 흰 글씨다. */
  foil: readonly [string, string, ...string[]] | null;
  /** 기울이지 않는 썸네일에 멈춰 보이는 포일 가루의 양. 높은 등급일수록 가만히 있어도 빛이 보인다. */
  restSparkles: number;
  /** 무광 인화의 종이 결 세기. 사진 색은 그대로 두고 결만 얹는다. */
  matte: number;
  /** 뒷면은 등급 색으로 만든 카드 몸체다. 높은 등급일수록 깊은 색에 박을 찍는다. */
  body: readonly [string, string, ...string[]];
  bodyInk: string;
  /** 몸체가 어두워 뒷면 숫자도 박으로 찍는지. */
  bodyFoil: boolean;
  /** 앞면 모서리에 새기는 등급 이름. 종이는 아직 얻은 게 없어 비운다. */
  engrave: string | null;
  /** 앞면 둘레 금속 모서리 두께(u). 종이는 0. */
  rim: number;
  /** 글씨 영역 길로셰 박 세기. 사진 전체에 무늬가 깔리는 플래티넘부터는 덜어낸다. */
  guilloche: number;
  /** 사진 전체 로제트 홀로그램의 빛 띠. 양 끝은 투명해야 띠로 보인다. 다이아는 결정면이 대신해 비운다. */
  rosette: readonly [string, string, ...string[]] | null;
  /** 이름을 볼록하게 찍는다. 글씨는 흰색 그대로, 빛·그늘 모서리만 생긴다. */
  emboss: boolean;
  /** 사진이 카드 면 뒤에 있는 것처럼 기울기와 반대로 밀리는 정도(카드 폭 비율). */
  parallax: number;
  /** 다이아 결정면 (FacetLayer). */
  facet: number;
  glitter: number;
  rainbow: number;
  gloss: number;
}

const NO_FX = {
  rim: 0,
  guilloche: 0,
  emboss: false,
  rosette: null,
  parallax: 0,
  facet: 0,
  glitter: 0,
  rainbow: 0,
  gloss: 1,
  matte: 0,
  restSparkles: 0,
  bodyFoil: false,
};

// 위로 갈수록 등급이 차지하는 자리가 둘레 → 글씨 영역 → 이름 → 사진 전체 → 깊이로 넓어진다.
export const ARTIST_MATERIAL: Record<ArtistGrade, ArtistMaterial> = {
  paper: {
    ...NO_FX,
    engrave: null,
    frame: ['#F3ECDD', '#DCD1BC', '#EEE6D4'],
    chipText: '#3A3226',
    foil: null,
    body: ['#EFE6D2', '#E2D5BB', '#ECE2CC'],
    bodyInk: '#3A3226',
    matte: 0.5,
    gloss: 0.3,
  },
  bronze: {
    ...NO_FX,
    engrave: 'BRONZE',
    frame: LEVEL_MATERIAL[1].frame,
    chipText: '#2E1608',
    foil: BRONZE_FOIL,
    body: ['#2E1C14', '#3D271C', '#24160F', '#36231A'],
    bodyInk: '#EBC7A8',
    bodyFoil: true,
    rim: 0.9,
    gloss: 0.7,
  },
  silver: {
    ...NO_FX,
    engrave: 'SILVER',
    frame: LEVEL_MATERIAL[2].frame,
    chipText: '#1C2230',
    foil: SILVER_FOIL,
    body: ['#25282E', '#363A42', '#1E2025', '#30343B'],
    bodyInk: '#DCE1E8',
    bodyFoil: true,
    rim: 0.9,
    guilloche: 0.55,
    gloss: 0.85,
  },
  gold: {
    ...NO_FX,
    engrave: 'GOLD',
    frame: LEVEL_MATERIAL[3].frame,
    chipText: '#3B2A00',
    foil: GOLD_FOIL,
    body: ['#121014', '#1D1A17', '#0C0B0D', '#18161A'],
    bodyInk: '#E9D092',
    bodyFoil: true,
    rim: 1,
    guilloche: 0.7,
    emboss: true,
    glitter: 0.8,
    restSparkles: 4,
  },
  // 플래티넘은 무지개 없이 차가운 흰 금속, 다이아는 결정면과 흰 섬광 위에 무지개를 얹는다.
  platinum: {
    ...NO_FX,
    engrave: 'PLATINUM',
    frame: ['#F7F9FB', '#AEB6C2', '#FFFFFF', '#8F98A6', '#E4E9EF'],
    chipText: '#1A1F2A',
    foil: ['#8C95A3', '#F2F5F8', '#FFFFFF', '#B4BCC8', '#EEF1F5'],
    body: ['#F7F8FA', '#D3D9E1', '#FFFFFF', '#DFE4EB'],
    bodyInk: '#1A1F2A',
    rim: 1.1,
    emboss: true,
    rosette: ['#FFFFFF00', '#FFFFFF59', '#E4E9EF80', '#FFFFFF59', '#FFFFFF00'],
    glitter: 0.9,
    restSparkles: 6,
    gloss: 1.1,
  },
  diamond: {
    ...NO_FX,
    engrave: 'DIAMOND',
    frame: ['#E8FBFF', '#F3E8FF', '#FFFFFF', '#E0F0FF'],
    chipText: '#152033',
    foil: ['#BFD0E6', '#FFFFFF', '#E6DAFF', '#FFFFFF', '#CFF0FF'],
    body: ['#F2F9FF', '#D6E6F4', '#FFFFFF', '#E1EDF8'],
    bodyInk: '#152033',
    rim: 1.1,
    emboss: true,
    parallax: 0.035,
    facet: 0.3,
    glitter: 1,
    restSparkles: 9,
    rainbow: 0.6,
    gloss: 1.2,
  },
};

export const HOLO_COLORS = [
  '#FF7A7A', '#FFE56A', '#9BFF73', '#6FF6FF', '#7F90FF', '#E07AFF',
  '#FF7A7A', '#FFE56A', '#9BFF73', '#6FF6FF', '#7F90FF', '#E07AFF', '#FF7A7A',
] as const;

export const SHOWROOM = {
  bg: '#0E0D13',
  fg: '#ECE8F1',
  fgDim: '#9B95A7',
  line: '#2B2834',
  glass: '#FFFFFF12',
} as const;

/** 연출 화면 맨 위 문구와 safe area 사이 간격. */
export const SHOWROOM_HEADING_TOP = 40;

export type { CardFonts } from './cardFontFamilies';
export { useCardFonts } from './cardFonts';
