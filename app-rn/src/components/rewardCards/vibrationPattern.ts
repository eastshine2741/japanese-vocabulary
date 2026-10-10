/** [시작 ms, 울림 ms] */
export type Pulse = [number, number];

/**
 * 안드로이드 Vibration 패턴 [쉼, 울림, 쉼, 울림…] 으로 바꾼다.
 * 앞 울림이 끝나기 전에 시작하는 울림은 이어 붙여 한 줄기로 울린다 — 진동은 겹쳐 울릴 수 없다.
 */
export function toPattern(pulses: Pulse[]): number[] {
  const pattern: number[] = [];
  let end = 0;
  for (const [at, on] of [...pulses].sort((a, b) => a[0] - b[0])) {
    if (pattern.length > 0 && at <= end) {
      const next = Math.max(end, at + on);
      pattern[pattern.length - 1] += next - end;
      end = next;
    } else {
      pattern.push(at - end, on);
      end = at + on;
    }
  }
  return pattern.map(Math.round);
}
