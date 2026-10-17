import { Linking } from 'react-native';
import { navigate } from '../navigation/navigationRef';
import { tokenStorage } from '../utils/tokenStorage';
import { isJwtExpired } from '../utils/jwt';
import { parseShareToken } from './shareLinks';

// 로그인 전에 받은 링크는 들고 있다가 로그인·가입이 끝나면 연다.
let pendingToken: string | null = null;

function receive(url: string | null): void {
  const token = parseShareToken(url);
  if (!token) return;
  pendingToken = token;
  consumePendingShareLink();
}

/** 들고 있는 공유 링크를 연다. 로그인 전이면 그대로 둔다. */
export async function consumePendingShareLink(): Promise<void> {
  const token = pendingToken;
  if (!token) return;
  const jwt = await tokenStorage.getToken();
  if (!jwt || isJwtExpired(jwt)) return;
  pendingToken = null;
  navigate('SharedCard', { token });
}

/** 앱을 연 링크와 실행 중에 들어오는 링크를 받는다. API base URL 이 정해진 뒤에 부른다. */
export function listenShareLinks(): () => void {
  Linking.getInitialURL().then(receive).catch(() => undefined);
  const sub = Linking.addEventListener('url', ({ url }) => receive(url));
  return () => sub.remove();
}
