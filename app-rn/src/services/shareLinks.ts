export const SHARE_HOST = 'kotonoha.eastshine.dev';

// 서명한 JWT 라 base64url 글자와 점이 들어간다.
const TOKEN = '([A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)';
const TAIL = '/?(?:[?#].*)?$';
const WEB_LINK = new RegExp(`^https?://${SHARE_HOST.replace(/\./g, '\\.')}/c/${TOKEN}${TAIL}`, 'i');
// 커스텀 scheme 은 OS 가 이 앱의 것만 넘겨주므로 이름을 따지지 않는다(dev 빌드는 scheme 이 다르다).
const APP_LINK = new RegExp(`^(?!https?:)[a-z][a-z0-9+.-]*://c/${TOKEN}${TAIL}`, 'i');

/** `https://kotonoha.eastshine.dev/c/{token}` 또는 `{scheme}://c/{token}` 에서 토큰. 아니면 null. */
export function parseShareToken(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(WEB_LINK) ?? url.trim().match(APP_LINK);
  return m ? m[1] : null;
}

/** 이미지 하단에 찍는 주소. 토큰은 길어 옮겨 적을 수 없으니 호스트만 남긴다. */
export function shareUrlLabel(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
}

/** X 글쓰기 화면. X 앱이 있으면 앱이, 없으면 브라우저가 연다. 카드 그림은 링크 미리보기(og:image)로 붙는다. */
export function xPostUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
