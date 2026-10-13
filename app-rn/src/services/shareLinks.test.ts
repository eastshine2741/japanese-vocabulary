import { describe, expect, it } from 'vitest';
import { parseShareToken, shareText, xPostUrl } from './shareLinks';

const T = 'eyJraWQiOiJ0In0.eyJrIjoicyIsImMiOjF9.Ab-_9z';

describe('parseShareToken', () => {
  it('웹 링크에서 토큰을 꺼낸다', () => {
    expect(parseShareToken(`https://kotonoha.eastshine.dev/c/${T}`)).toBe(T);
  });

  it('앱 scheme 링크에서 토큰을 꺼낸다', () => {
    expect(parseShareToken(`kotonoha://c/${T}`)).toBe(T);
    expect(parseShareToken(`kotonoha.main://c/${T}`)).toBe(T);
  });

  it('끝 슬래시·쿼리·해시는 무시한다', () => {
    expect(parseShareToken(`https://kotonoha.eastshine.dev/c/${T}/`)).toBe(T);
    expect(parseShareToken(`https://kotonoha.eastshine.dev/c/${T}?utm_source=x`)).toBe(T);
    expect(parseShareToken(`kotonoha://c/${T}/?a=1#f`)).toBe(T);
  });

  it('다른 호스트·경로·서명 없는 토큰은 null', () => {
    expect(parseShareToken(`https://evil.example.com/c/${T}`)).toBeNull();
    expect(parseShareToken(`https://kotonoha.eastshine.dev/admin/${T}`)).toBeNull();
    expect(parseShareToken('https://kotonoha.eastshine.dev/c/')).toBeNull();
    expect(parseShareToken('https://kotonoha.eastshine.dev/c/abc/def')).toBeNull();
    expect(parseShareToken('https://kotonoha.eastshine.dev/c/aB3dE5gH7j')).toBeNull();
    expect(parseShareToken(`kotonoha://song/${T}`)).toBeNull();
    expect(parseShareToken(null)).toBeNull();
    expect(parseShareToken('')).toBeNull();
  });
});

describe('xPostUrl', () => {
  it('글을 인코딩해 X 글쓰기 주소를 만든다', () => {
    expect(xPostUrl('「夜に駆ける」 & more')).toBe(`https://x.com/intent/post?text=${encodeURIComponent('「夜に駆ける」 & more')}`);
  });
});

describe('shareText', () => {
  const url = `https://kotonoha.eastshine.dev/c/${T}`;
  it('얻은 사람·카드, 훅과 링크, 앱 소개를 줄을 띄워 잇는다', () => {
    expect(shareText('동현', '夜に駆ける', 'song', url)).toBe(
      `동현님이 「夜に駆ける」 곡 카드를 얻었어요!\n\n나도 최애곡 카드 만들러 가기 👉 ${url}\n\n노래로 배우는 일본어, 코토노하`,
    );
    expect(shareText('동현', 'YOASOBI', 'artist', url)).toBe(
      `동현님이 「YOASOBI」 아티스트 카드를 얻었어요!\n\n나도 최애 아티스트 카드 만들러 가기 👉 ${url}\n\n노래로 배우는 일본어, 코토노하`,
    );
  });
});
