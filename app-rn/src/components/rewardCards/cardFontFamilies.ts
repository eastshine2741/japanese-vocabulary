import { Platform } from 'react-native';

/** 일본어는 명조(가사·제목), 한국어는 바탕(이름·뜻·라벨). 서로 글리프가 없어 섞으면 시스템 폰트로 빠진다. */
export interface CardFonts {
  jp: string;
  jpHeavy: string;
  ko: string;
  koBold: string;
}

export const CARD_FONTS: CardFonts = {
  jp: 'ShipporiMinchoB1_700Bold',
  jpHeavy: 'ShipporiMinchoB1_800ExtraBold',
  ko: 'GowunBatang_400Regular',
  koBold: 'GowunBatang_700Bold',
};

const FALLBACK_JP = Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' });
const FALLBACK_KO = Platform.select({ ios: 'AppleMyungjo', default: 'serif' });

export const FALLBACK_CARD_FONTS: CardFonts = { jp: FALLBACK_JP, jpHeavy: FALLBACK_JP, ko: FALLBACK_KO, koBold: FALLBACK_KO };
