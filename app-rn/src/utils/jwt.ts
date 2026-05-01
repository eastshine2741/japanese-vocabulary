export function isJwtExpired(token: string): boolean {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return true;
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
