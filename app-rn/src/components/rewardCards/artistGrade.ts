export type ArtistGrade = 'paper' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface ArtistGradeStep {
  grade: ArtistGrade;
  label: string;
  /** 이 재질이 되는 마스터 곡 수. */
  from: number;
}

// 납찰(納札)처럼 위로 갈수록 구간이 넓어져, 곡이 많은 아티스트의 팬에게도 위가 남는다. 마스터 곡 수엔 상한이 없다.
export const ARTIST_GRADE_STEPS: readonly ArtistGradeStep[] = [
  { grade: 'paper', label: '종이', from: 0 },
  { grade: 'bronze', label: '동', from: 1 },
  { grade: 'silver', label: '은', from: 3 },
  { grade: 'gold', label: '금', from: 7 },
  { grade: 'platinum', label: '플래티넘', from: 15 },
  { grade: 'diamond', label: '다이아', from: 30 },
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
