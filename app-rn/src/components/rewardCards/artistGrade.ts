import type { ArtistRewardCard } from './types';

export type ArtistGrade = 'paper' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface ArtistGradeStep {
  grade: ArtistGrade;
  label: string;
  /** 이 재질이 되는 마스터 곡 수. */
  from: number;
}

// 납찰(納札)처럼 위로 갈수록 구간이 넓어져, 곡이 많은 아티스트의 팬에게도 위가 남는다. 마스터 곡 수엔 상한이 없다.
export const ARTIST_GRADE_STEPS: readonly ArtistGradeStep[] = [
  { grade: 'paper', label: '기본', from: 0 },
  { grade: 'bronze', label: 'BRONZE', from: 1 },
  { grade: 'silver', label: 'SILVER', from: 3 },
  { grade: 'gold', label: 'GOLD', from: 7 },
  { grade: 'platinum', label: 'PLATINUM', from: 15 },
  { grade: 'diamond', label: 'DIAMOND', from: 30 },
];

export function artistGradeStep(masteredCount: number): ArtistGradeStep {
  let step = ARTIST_GRADE_STEPS[0];
  for (const s of ARTIST_GRADE_STEPS) if (masteredCount >= s.from) step = s;
  return step;
}

/** 최고 재질이면 null. */
export function nextArtistGradeStep(masteredCount: number): ArtistGradeStep | null {
  return ARTIST_GRADE_STEPS.find((s) => masteredCount < s.from) ?? null;
}


/** 세트리스트에 다 못 적으면 오래된 곡부터 줄이고 최근 곡을 남긴다. */
export function setlistWindow(masteredCount: number, capacity: number): { start: number; hidden: number } {
  const hidden = Math.max(0, masteredCount - capacity);
  return { start: hidden, hidden };
}

export type ArtistCardSort = 'level' | 'recent';

export const ARTIST_CARD_SORT_LABEL: Record<ArtistCardSort, string> = {
  level: '레벨순',
  recent: '최근순',
};

export const ARTIST_CARD_SORT_ORDER: ArtistCardSort[] = ['level', 'recent'];

/** 레벨순은 마스터 곡이 많은(재질이 높은) 카드부터 같으면 먼저 팬이 된 카드부터, 최근순은 최근에 받은 카드부터. */
export function sortArtistCards(cards: ArtistRewardCard[], sort: ArtistCardSort = 'level'): ArtistRewardCard[] {
  const sorted = [...cards];
  if (sort === 'level') sorted.sort((a, b) => b.masteredCount - a.masteredCount || a.since.localeCompare(b.since));
  if (sort === 'recent') sorted.sort((a, b) => b.since.localeCompare(a.since));
  return sorted;
}
