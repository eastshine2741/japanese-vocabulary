import { useEffect, useState } from 'react';
import { CARD_FONTS, CardFonts, FALLBACK_CARD_FONTS } from './cardFontFamilies';

// 명조 TTF 는 굵기마다 15MB 라 웹은 Google Fonts 에서 화면에 쓰인 글자 조각만 받는다.
// 받은 CSS 의 family 이름을 앱과 같은 이름으로 바꿔 카드 스타일을 그대로 쓴다.
const FACES: ReadonlyArray<[family: string, query: string]> = [
  [CARD_FONTS.jp, 'Shippori+Mincho+B1:wght@700'],
  [CARD_FONTS.jpHeavy, 'Shippori+Mincho+B1:wght@800'],
  [CARD_FONTS.ko, 'Gowun+Batang:wght@400'],
  [CARD_FONTS.koBold, 'Gowun+Batang:wght@700'],
];

let loading: Promise<void> | null = null;

async function addFace(family: string, query: string): Promise<void> {
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`);
  if (!res.ok) throw new Error(`font css ${res.status}`);
  const style = document.createElement('style');
  style.textContent = (await res.text()).replace(/font-family:\s*'[^']*'/g, `font-family: '${family}'`);
  document.head.appendChild(style);
}

function loadFaces(): Promise<void> {
  loading ??= Promise.all(FACES.map(([family, query]) => addFace(family, query))).then(() => undefined);
  return loading;
}

export function useCardFonts(): CardFonts {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadFaces().then(
      () => !cancelled && setLoaded(true),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return loaded ? CARD_FONTS : FALLBACK_CARD_FONTS;
}
