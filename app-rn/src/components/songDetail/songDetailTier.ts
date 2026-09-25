import type { SongWordTierDto, SongWordTierKey } from '../../types/song';

/** 레일 점 모양. 끝난 단계는 체크, 그 다음 한 칸이 현재, 나머지는 예정. */
export type SongWordTierStatus = 'done' | 'current' | 'todo';

/** 카드 한 장 분량의 학습 시간 추정치(초). 8개면 약 3분이 되는 눈금. */
const SECONDS_PER_DUE_WORD = 20;

/**
 * 남은 단어(한 번도 리뷰 안 한 단어)가 없으면 끝난 단계다. 한 번 리뷰한 단어는 남음으로 돌아가지
 * 않으니 끝난 단계는 계속 끝난 상태다 — 다시 due 가 된 카드는 히어로의 `오늘 복습 N개` 가 맡는다.
 * 단어가 없는 단계도 끝난 것으로 본다 — 현재 단계로 걸려 학습 버튼이 영원히 잠기지 않게.
 */
export function isTierDone(tier: SongWordTierDto): boolean {
  return tier.longTermCount + tier.shortTermCount >= tier.totalCount;
}

/** 앞에서부터 처음 만나는 미완료 단계가 현재 단계다. 모두 끝났으면 null. */
export function selectCurrentTier(tiers: readonly SongWordTierDto[]): SongWordTierDto | null {
  return tiers.find(tier => !isTierDone(tier)) ?? null;
}

/**
 * 화면 진입 시 펼쳐 둘 카드 — 현재 단계. 모두 끝났으면 마지막(완곡) 카드를 펼친다.
 * 항상 정확히 한 장이 펼쳐진다.
 */
export function selectExpandedTierKey(tiers: readonly SongWordTierDto[]): SongWordTierKey | null {
  if (tiers.length === 0) return null;
  return (selectCurrentTier(tiers) ?? tiers[tiers.length - 1]).key;
}

/** 펼침 여부와는 무관하다. */
export function getTierStatus(tiers: readonly SongWordTierDto[], index: number): SongWordTierStatus {
  const tier = tiers[index];
  if (tier == null) return 'todo';
  if (isTierDone(tier)) return 'done';
  return tiers.findIndex(candidate => !isTierDone(candidate)) === index ? 'current' : 'todo';
}

/** CTA 의 예상 소요시간(분). 올림이라 1개만 남아도 `약 1분` 으로 보인다. */
export function estimateStudyMinutes(dueCount: number): number {
  if (dueCount <= 0) return 0;
  return Math.max(1, Math.ceil((dueCount * SECONDS_PER_DUE_WORD) / 60));
}

export interface SongWordTierSegments {
  longTermRatio: number;
  shortTermRatio: number;
  remainingCount: number;
}

/** 진행 바 세 구간. 서버 값이 총합을 넘어도 바가 터지지 않게 잘라 쓴다. */
export function buildTierSegments(tier: SongWordTierDto): SongWordTierSegments {
  const total = Math.max(0, tier.totalCount);
  const longTerm = Math.min(Math.max(0, tier.longTermCount), total);
  const shortTerm = Math.min(Math.max(0, tier.shortTermCount), total - longTerm);
  return {
    longTermRatio: total > 0 ? longTerm / total : 0,
    shortTermRatio: total > 0 ? shortTerm / total : 0,
    remainingCount: total - longTerm - shortTerm,
  };
}
