const INTERVAL_UNITS: Record<string, string> = { m: '분', h: '시간', d: '일' };

/** 서버 interval(`12m`/`3h`/`4d`)을 `12분`/`3시간`/`4일`로 바꾼다. 모르는 형식은 그대로 둔다. */
export function formatInterval(interval: string): string {
  const match = /^(\d+)([mhd])$/.exec(interval);
  if (!match) return interval;
  return `${match[1]}${INTERVAL_UNITS[match[2]]}`;
}

/** 선택한 rating 의 홀드 pill 문구. */
export function holdLabel(label: string, interval?: string): string {
  if (!interval) return label;
  if (interval === '0m') return '잠시 후 다시 만나요';
  return `${formatInterval(interval)} 뒤에 다시 만나요`;
}
