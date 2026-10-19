import { ShipporiMinchoB1_700Bold, ShipporiMinchoB1_800ExtraBold } from '@expo-google-fonts/shippori-mincho-b1';
import { GowunBatang_400Regular, GowunBatang_700Bold, useFonts } from '@expo-google-fonts/gowun-batang';
import { CARD_FONTS, CardFonts, FALLBACK_CARD_FONTS } from './cardFontFamilies';

// 웹은 cardFonts.web.ts.
export function useCardFonts(): CardFonts {
  const [loaded] = useFonts({
    ShipporiMinchoB1_700Bold,
    ShipporiMinchoB1_800ExtraBold,
    GowunBatang_400Regular,
    GowunBatang_700Bold,
  });
  return loaded ? CARD_FONTS : FALLBACK_CARD_FONTS;
}
