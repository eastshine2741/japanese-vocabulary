/**
 * 카드 한 장에 쓰는 시간. 소요 시간 문구("약 7분")는 전부 이 상수에서 나온다 —
 * 서버가 따로 내려주지 않는다.
 */
export const SECONDS_PER_CARD = 25;

/** 오늘 목록을 어떻게 골랐는지 — 새 카드는 '잊어버리기 직전'이 아니라 따로 센다. */
export function selectionLine(dueToday: number, newToday: number, studiedCards: number): string | null {
  const review = dueToday - newToday;
  if (review > 0 && newToday > 0) return `잊어버리기 직전인 단어 ${review}장과 새 단어 ${newToday}장이에요`;
  if (review > 0) return `외운 단어 ${studiedCards}장 중 잊어버리기 직전인 ${review}장만 골랐어요`;
  if (newToday > 0) return `처음 배우는 새 단어 ${newToday}장이에요`;
  return null;
}

/** y축 눈금 — 0 부터 [max] 이하까지, max/4 에 가장 가까운 1·2·2.5·5 × 10ⁿ 정수 간격. */
export function yAxisTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10]
    .map(m => m * pow)
    .filter(s => Number.isInteger(s))
    .reduce((best, s) => (Math.abs(Math.log(s / raw)) < Math.abs(Math.log(best / raw)) ? s : best), Math.max(1, pow));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

/** 카드 수 -> 분. 0장이면 0분, 그 외에는 최소 1분. */
export function estimateMinutes(cards: number): number {
  if (cards <= 0) return 0;
  return Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60));
}
