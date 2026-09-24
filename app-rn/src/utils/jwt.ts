function decodePayload(token: string): Record<string, unknown> | null {
  const payloadB64 = token.split('.')[1];
  if (!payloadB64) return null;
  const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export function isJwtExpired(token: string): boolean {
  try {
    const payload = decodePayload(token);
    if (!payload) return true;
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/** subject 는 users.id. 분석 지표를 DB 유저와 같은 키로 묶는 데 쓴다. */
export function getJwtUserId(token: string): string | null {
  try {
    const sub = decodePayload(token)?.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}
