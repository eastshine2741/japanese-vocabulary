/**
 * Collapses an Axios failure into a user-facing message.
 *
 * A request that never got a response (DNS, TLS, ATS block, server down) carries no
 * `response`, so reading `response.data.message` yields the caller's generic fallback
 * and every unrelated failure ends up wearing the same label. Naming the transport
 * failure separately keeps "the server said no" distinguishable from "we never
 * reached the server".
 */
export function apiErrorMessage(e: any, fallback: string): string {
  const serverMessage = e?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (!e?.response) return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
  return fallback;
}
