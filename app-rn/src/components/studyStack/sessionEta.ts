/** prod 카드 간 간격 중앙값(GA4 card_rate). 유저마다 2~10초로 갈려 몇 장 재면 그 유저 값으로 바꾼다. */
export const DEFAULT_SECONDS_PER_CARD = 5;
/** 이만큼 재기 전엔 기본값을 쓴다 — 처음 한두 장은 읽는 데 오래 걸려 들쭉날쭉하다. */
const MIN_SAMPLES = 3;
/** 이보다 긴 간격은 자리를 비운 것이라 속도에 넣지 않는다. */
export const MAX_CARD_GAP_SECONDS = 120;

/** 카드 간 간격(초)들로 카드당 시간을 잡는다. 오래 멈춘 한 장에 끌려가지 않게 중앙값을 쓴다. */
export function estimateSecondsPerCard(gaps: number[]): number {
  if (gaps.length < MIN_SAMPLES) return DEFAULT_SECONDS_PER_CARD;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 남은 장수의 예상 시간 문구. 초 단위는 "모름" 으로 장수가 늘 때마다 튀어서 분으로만 보여준다. */
export function remainingTimeLabel(remainingCards: number, secondsPerCard: number): string | null {
  if (remainingCards <= 0) return null;
  const minutes = Math.max(1, Math.round((remainingCards * secondsPerCard) / 60));
  return `약 ${minutes}분`;
}
