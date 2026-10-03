/**
 * A request with no `response` (DNS, TLS, ATS block, server down) gets its own
 * message so it stays distinguishable from a server-side error.
 */
export function apiErrorMessage(e: any, fallback: string): string {
  const serverMessage = e?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (!e?.response) return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
  return fallback;
}
