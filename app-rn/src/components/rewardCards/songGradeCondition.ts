import type { SongGradeRuleDto } from '../../types/rewardCard';
import { SONG_CARD_KINDS } from './cardKinds';

export interface SongGradeCondition {
  /** 획득 연출 사다리처럼 아주 좁은 자리. */
  caption: string;
  /** 타일처럼 좁은 자리. */
  short: string;
  full: string;
}

const BLANK: SongGradeCondition = { caption: '', short: '', full: '' };

/** SONG_CARD_KINDS 자리(rung)마다의 조건. 단계 이름과 마스터 기준은 서버 규칙에서 오고, 아직 못 받았으면 빈 문구다. */
export function songGradeCondition(rung: number, rule: SongGradeRuleDto | null): SongGradeCondition {
  const kind = SONG_CARD_KINDS[rung];
  if (kind == null) return BLANK;
  if (!kind.mastered && kind.level === 0) return { caption: '첫 학습', short: '첫 학습', full: '이 곡의 단어 처음 공부하기' };
  if (rule == null) return BLANK;
  if (kind.mastered) {
    const p = rule.masterPercent;
    return { caption: `${p}% 장기 기억`, short: `단어 ${p}% 장기 기억`, full: `곡 단어의 ${p}%를 장기 기억으로 만들기` };
  }
  const name = rule.tierNames[kind.level - 1];
  if (name == null) return BLANK;
  return { caption: name, short: `'${name}' 단계 완료`, full: `'${name}' 단계 단어 모두 공부하기` };
}
