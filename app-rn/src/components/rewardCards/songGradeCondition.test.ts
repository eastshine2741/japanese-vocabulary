import { describe, expect, it } from 'vitest';
import { songGradeCondition } from './songGradeCondition';

const rule = { tierNames: ['후렴 정복', '따라 부르기', '완곡'], masterPercent: 90 };

describe('songGradeCondition', () => {
  it('names the tier each level finishes, in grade order', () => {
    expect(songGradeCondition(1, rule).full).toBe("'후렴 정복' 단계 단어 모두 공부하기");
    expect(songGradeCondition(3, rule).caption).toBe('완곡');
  });

  it('takes the master threshold from the rule', () => {
    expect(songGradeCondition(4, { ...rule, masterPercent: 80 }).full).toBe('곡 단어의 80%를 장기 기억으로 만들기');
  });

  it('leaves server-owned conditions blank until the rule arrives', () => {
    expect(songGradeCondition(0, null).full).toBe('이 곡의 단어 처음 공부하기');
    expect(songGradeCondition(2, null).full).toBe('');
    expect(songGradeCondition(4, null).full).toBe('');
  });
});
