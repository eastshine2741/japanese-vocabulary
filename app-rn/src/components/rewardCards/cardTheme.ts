import { Platform } from 'react-native';
import {
  useFonts,
  ShipporiMinchoB1_700Bold,
  ShipporiMinchoB1_800ExtraBold,
} from '@expo-google-fonts/shippori-mincho-b1';
import { GowunBatang_400Regular, GowunBatang_700Bold } from '@expo-google-fonts/gowun-batang';
import type { ArtistGrade } from './artistGrade';
import { CardLevel } from './types';

export const CARD_RATIO = 88 / 63;
export const ARTIST_CARD_RATIO = 54 / 85.6;

interface LevelMaterial {
  tier: string;
  frame: readonly [string, string, ...string[]];
  pip: string;
  chipText: string;
}

export const LEVEL_MATERIAL: Record<CardLevel, LevelMaterial> = {
  1: { tier: '후렴 정복', frame: ['#4A4555', '#2A2632', '#3B3644'], pip: '#CFC8DA', chipText: '#F1ECF7' },
  2: { tier: '따라 부르기', frame: ['#E6E9EF', '#8A93A3', '#F7F8FB', '#7D8698', '#E9ECF2'], pip: '#E7EBF2', chipText: '#1C2230' },
  3: { tier: '완곡', frame: ['#FBE7A6', '#B8862C', '#FFF4C9', '#9C6C1E', '#F6DC8E'], pip: '#F6DC8E', chipText: '#3B2A00' },
};

interface ArtistMaterial {
  frame: readonly [string, string, ...string[]];
  chipText: string;
  /** 테 없이 사진을 끝까지 깐다. */
  fullBleed: boolean;
  frameHolo: number;
  artHolo: number;
  etch: number;
  glitter: number;
  rainbow: number;
  gloss: number;
}

const NO_FX = { fullBleed: false, frameHolo: 0, artHolo: 0, etch: 0, glitter: 0, rainbow: 0, gloss: 1 };

export const ARTIST_MATERIAL: Record<ArtistGrade, ArtistMaterial> = {
  paper: { ...NO_FX, frame: ['#F3ECDD', '#DCD1BC', '#EEE6D4'], chipText: '#3A3226', gloss: 0.3 },
  bronze: {
    ...NO_FX,
    frame: ['#EDBB92', '#8A4E2B', '#F6D0AC', '#6E3B1E', '#D99A6B'],
    chipText: '#2E1608',
    frameHolo: 0.1,
    etch: 0.6,
  },
  silver: { ...NO_FX, frame: LEVEL_MATERIAL[2].frame, chipText: '#1C2230', frameHolo: 0.2, etch: 0.8 },
  gold: {
    ...NO_FX,
    frame: LEVEL_MATERIAL[3].frame,
    chipText: '#3B2A00',
    frameHolo: 0.45,
    artHolo: 0.14,
    etch: 0.8,
    glitter: 0.8,
  },
  platinum: {
    ...NO_FX,
    frame: ['#F7F9FB', '#AEB6C2', '#FFFFFF', '#8F98A6', '#E4E9EF'],
    chipText: '#1A1F2A',
    frameHolo: 0.55,
    artHolo: 0.18,
    etch: 0.9,
    glitter: 0.8,
    rainbow: 0.35,
  },
  diamond: {
    ...NO_FX,
    frame: ['#E8FBFF', '#F3E8FF', '#FFFFFF', '#E0F0FF'],
    chipText: '#152033',
    fullBleed: true,
    etch: 0.5,
    glitter: 1,
    rainbow: 1,
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

const FALLBACK_JP = Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' });
const FALLBACK_KO = Platform.select({ ios: 'AppleMyungjo', default: 'serif' });

/** 일본어는 명조(가사·제목), 한국어는 바탕(이름·뜻·라벨). 서로 글리프가 없어 섞으면 시스템 폰트로 빠진다. */
export interface CardFonts {
  jp: string;
  jpHeavy: string;
  ko: string;
  koBold: string;
}

export function useCardFonts(): CardFonts {
  const [loaded] = useFonts({
    ShipporiMinchoB1_700Bold,
    ShipporiMinchoB1_800ExtraBold,
    GowunBatang_400Regular,
    GowunBatang_700Bold,
  });
  return loaded
    ? { jp: 'ShipporiMinchoB1_700Bold', jpHeavy: 'ShipporiMinchoB1_800ExtraBold', ko: 'GowunBatang_400Regular', koBold: 'GowunBatang_700Bold' }
    : { jp: FALLBACK_JP, jpHeavy: FALLBACK_JP, ko: FALLBACK_KO, koBold: FALLBACK_KO };
}
