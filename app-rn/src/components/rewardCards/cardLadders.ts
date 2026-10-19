import type { SongGradeRuleDto } from '../../types/rewardCard';
import { ARTIST_GRADE_STEPS } from './artistGrade';
import { SONG_CARD_KINDS, songTierName } from './cardKinds';
import { songGradeCondition } from './songGradeCondition';

/** 승급 계단 한 칸. */
export interface LadderStep {
  label: string;
  /** 그 계단에 오르는 조건을 짧게. */
  caption: string;
}

/** 레벨 n 은 n번째 단계 단어를 다 공부한 카드다. 등급 이름에 단계 이름을 쓰지 않고 조건으로만 붙인다. */
export function songLadder(rule: SongGradeRuleDto | null): LadderStep[] {
  return SONG_CARD_KINDS.map((kind, rung) => ({
    label: songTierName(kind.level, kind.mastered),
    caption: songGradeCondition(rung, rule).caption,
  }));
}

export const ARTIST_LADDER: readonly LadderStep[] = ARTIST_GRADE_STEPS.map((s) => ({
  label: s.label,
  caption: s.from === 0 ? '첫 곡 카드' : `MASTER 카드 ${s.from}장`,
}));
