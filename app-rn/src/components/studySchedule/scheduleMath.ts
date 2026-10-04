/**
 * 카드 한 장에 쓰는 시간. 소요 시간 문구("약 7분")는 전부 이 상수에서 나온다 —
 * 서버가 따로 내려주지 않는다.
 */
export const SECONDS_PER_CARD = 25;

/** 카드 수 -> 분. 0장이면 0분, 그 외에는 최소 1분. */
export function estimateMinutes(cards: number): number {
  if (cards <= 0) return 0;
  return Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60));
}
