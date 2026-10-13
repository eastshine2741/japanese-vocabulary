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

/**
 * X 글쓰기 화면. X 앱이 있으면 앱이, 없으면 브라우저가 연다. 카드 그림은 링크 미리보기(og:image)로 붙는다.
 * url 파라미터는 글 맨 끝에 붙으므로 링크는 글 안에 넣어 둔다.
 */
export function xPostUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** 카드를 받은 사람이 자기 카드를 만들러 오게 하는 한 줄. 스토리 스티커·X 글·링크 글이 같이 쓴다. */
export function shareHook(kind: 'song' | 'artist'): string {
  return kind === 'song' ? '나도 최애곡 카드 만들러 가기' : '나도 최애 아티스트 카드 만들러 가기';
}

/** 스토어 이름이 한국어 '코토노하'라 검색 안내도 한국어로 쓴다. */
export const APP_NAME = '코토노하';
export const APP_PITCH = '노래로 배우는 일본어';
export const STORE_SEARCH = `앱스토어 · 플레이스토어에서 '${APP_NAME}' 검색`;

/** X·링크 공유 글. 누가 무슨 카드를 얻었는지 → 훅과 링크 → 앱 소개 순이다. */
export function shareText(owner: string, title: string, kind: 'song' | 'artist', url: string): string {
  const card = kind === 'song' ? '곡 카드' : '아티스트 카드';
  return `${owner}님이 「${title}」 ${card}를 얻었어요!\n\n${shareHook(kind)} 👉 ${url}\n\n${APP_PITCH}, ${APP_NAME}`;
}
