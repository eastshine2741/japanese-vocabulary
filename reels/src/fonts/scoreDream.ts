import {continueRender, delayRender} from 'remotion';
import {useEffect, useState} from 'react';

import weight400 from './SCDream4.woff2';
import weight500 from './SCDream5.woff2';
import weight600 from './SCDream6.woff2';
import weight700 from './SCDream7.woff2';
import weight800 from './SCDream8.woff2';

// 에스코어 드림은 한글·라틴만 있다. 일본어는 뒤의 Noto CJK 로 떨어진다.
export const SCORE_DREAM_FAMILY = 'S-Core Dream';

// 파일 번호와 CSS weight 가 다르다(4 Regular → 400, 6 Bold → 600, 8 Heavy → 800). PromoReel 이 쓰는 굵기만 담는다.
const faces: Array<{weight: number; url: string}> = [
  {weight: 400, url: weight400},
  {weight: 500, url: weight500},
  {weight: 600, url: weight600},
  {weight: 700, url: weight700},
  {weight: 800, url: weight800},
];

let loading: Promise<void> | null = null;

// 렌더 브라우저와 어드민 Player 양쪽에서 한 번만 등록한다.
const loadScoreDream = (): Promise<void> => {
  if (loading) return loading;
  loading = Promise.all(
    faces.map(async ({weight, url}) => {
      const face = new FontFace(SCORE_DREAM_FAMILY, `url(${url})`, {weight: String(weight)});
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return loading;
};

// 폰트가 뜨기 전 프레임이 Noto 로 찍히지 않게 로드가 끝날 때까지 렌더를 잡아 둔다.
export const useScoreDream = () => {
  const [handle] = useState(() => delayRender('Loading S-Core Dream'));
  useEffect(() => {
    loadScoreDream()
      .catch((error) => console.error('S-Core Dream 로드 실패, 대체 폰트로 그린다.', error))
      .finally(() => continueRender(handle));
  }, [handle]);
};
