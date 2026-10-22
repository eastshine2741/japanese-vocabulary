/** prod 카드 간 간격 평균(GA4 card_rate, 120초 컷). 완주 세션의 머문 시간 ÷ 장수 중앙값(8.7초)과도 맞는다. */
export const DEFAULT_SECONDS_PER_CARD = 9;
/** 이만큼 재기 전엔 기본값을 쓴다 — 처음 한두 장은 읽는 데 오래 걸려 들쭉날쭉하다. */
const MIN_SAMPLES = 3;
/** 이보다 긴 간격은 자리를 비운 것이라 속도에 넣지 않는다. */
export const MAX_CARD_GAP_SECONDS = 120;

/** 남은 시간은 간격의 합이라 평균을 쓴다. 중앙값은 오래 걸리는 카드를 빼먹어 절반 가까이 짧게 나온다. */
export function estimateSecondsPerCard(gaps: number[]): number {
  if (gaps.length < MIN_SAMPLES) return DEFAULT_SECONDS_PER_CARD;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

/** 남은 장수의 예상 시간 문구. 초 단위는 "모름" 으로 장수가 늘 때마다 튀어서 분으로만 보여준다. */
export function remainingTimeLabel(remainingCards: number, secondsPerCard: number): string | null {
  if (remainingCards <= 0) return null;
  const minutes = Math.max(1, Math.round((remainingCards * secondsPerCard) / 60));
  return `${minutes}분`;
}
