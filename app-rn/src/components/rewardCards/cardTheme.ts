import { Platform } from 'react-native';
import {
  useFonts,
  ShipporiMinchoB1_700Bold,
  ShipporiMinchoB1_800ExtraBold,
} from '@expo-google-fonts/shippori-mincho-b1';
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

const FALLBACK_SERIF = Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' });

export function useMinchoFamily(): { bold: string; extraBold: string } {
  const [loaded] = useFonts({ ShipporiMinchoB1_700Bold, ShipporiMinchoB1_800ExtraBold });
  return loaded
    ? { bold: 'ShipporiMinchoB1_700Bold', extraBold: 'ShipporiMinchoB1_800ExtraBold' }
    : { bold: FALLBACK_SERIF, extraBold: FALLBACK_SERIF };
}

export { seededRandom } from './seededRandom';
