import { describe, expect, it } from 'vitest';
import { parseShareToken, shareUrlLabel, xPostUrl } from './shareLinks';

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

describe('shareUrlLabel', () => {
  it('호스트만 남긴다', () => {
    expect(shareUrlLabel(`https://kotonoha.eastshine.dev/c/${T}`)).toBe('kotonoha.eastshine.dev');
    expect(shareUrlLabel(`http://27.35.45.138/main/c/${T}`)).toBe('27.35.45.138');
  });
});

describe('xPostUrl', () => {
  it('글과 링크를 인코딩해 X 글쓰기 주소를 만든다', () => {
    expect(xPostUrl('「夜に駆ける」 & more', `https://kotonoha.eastshine.dev/c/${T}`)).toBe(
      `https://x.com/intent/post?text=${encodeURIComponent('「夜に駆ける」 & more')}&url=${encodeURIComponent(`https://kotonoha.eastshine.dev/c/${T}`)}`,
    );
  });
});
