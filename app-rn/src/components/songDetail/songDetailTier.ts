import type { SongWordTierDto, SongWordTierKey } from '../../types/song';

/** 레일 점 모양. 끝난 단계는 체크, 그 다음 한 칸이 현재, 나머지는 예정. */
export type SongWordTierStatus = 'done' | 'current' | 'todo';

/** 카드 한 장 분량의 학습 시간 추정치(초). 8개면 약 3분이 되는 눈금. */
const SECONDS_PER_DUE_WORD = 20;

/**
 * 한 번도 리뷰 안 한 단어가 없으면 끝난 단계다. 다시 due 가 된 카드는 히어로의 `오늘 복습 N개` 가 맡는다.
 * 단어가 없는 단계도 끝난 것으로 본다 — 현재 단계로 걸려 학습 버튼이 영원히 잠기지 않게.
 */
export function isTierDone(tier: SongWordTierDto): boolean {
  return tier.longTermCount + tier.shortTermCount >= tier.totalCount;
}

/** 앞에서부터 처음 만나는 미완료 단계가 현재 단계다. 모두 끝났으면 null. */
export function selectCurrentTier(tiers: readonly SongWordTierDto[]): SongWordTierDto | null {
  return tiers.find(tier => !isTierDone(tier)) ?? null;
}

/** 화면 진입 시 펼쳐 둘 카드 — 현재 단계. 모두 끝났으면 마지막(완곡) 카드. */
export function selectExpandedTierKey(tiers: readonly SongWordTierDto[]): SongWordTierKey | null {
  if (tiers.length === 0) return null;
  return (selectCurrentTier(tiers) ?? tiers[tiers.length - 1]).key;
}

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

/** 곡 카드 마스터 기준. 정직하게 공부해도 due 마다 약 10% 는 잊혀서 '전부'가 아니라 90% 다. */
export const SONG_CARD_MASTER_RATIO = 0.9;

export interface SongCardProgress {
  /** 앞에서부터 끝낸 단계 수. 0 이면 아직 카드가 없다. */
  level: 0 | 1 | 2 | 3;
  mastered: boolean;
  /** 곡 단어 중 장기기억 비율. */
  longTermRatio: number;
}

/** 단계 n 을 끝내면 레벨 n 카드다. 단계는 순서대로만 오르므로 앞에서부터 이어진 완료 단계만 센다. */
export function getSongCardProgress(tiers: readonly SongWordTierDto[]): SongCardProgress {
  let level = 0;
  while (level < tiers.length && level < 3 && isTierDone(tiers[level])) level++;
  const total = tiers.reduce((sum, tier) => sum + Math.max(0, tier.totalCount), 0);
  const longTerm = tiers.reduce((sum, tier) => sum + Math.max(0, tier.longTermCount), 0);
  const longTermRatio = total > 0 ? Math.min(1, longTerm / total) : 0;
  return {
    level: level as SongCardProgress['level'],
    mastered: level === 3 && longTermRatio >= SONG_CARD_MASTER_RATIO,
    longTermRatio,
  };
}
