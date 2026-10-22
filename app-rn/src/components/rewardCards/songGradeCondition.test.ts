import { describe, expect, it } from 'vitest';
import { songGradeCondition } from './songGradeCondition';

const rule = { tierNames: ['후렴 정복', '따라 부르기', '완곡'], masterPercent: 90 };

describe('songGradeCondition', () => {
  it('names the tier each level finishes, in grade order', () => {
    expect(songGradeCondition(0, rule).full).toBe("'후렴 정복' 단계 단어 모두 공부하기");
    expect(songGradeCondition(2, rule).caption).toBe('완곡');
  });

  it('takes the master threshold from the rule', () => {
    expect(songGradeCondition(3, { ...rule, masterPercent: 80 }).full).toBe('곡 단어의 80%를 장기 기억으로 만들기');
  });

  it('leaves server-owned conditions blank until the rule arrives', () => {
    expect(songGradeCondition(1, null).full).toBe('');
    expect(songGradeCondition(3, null).full).toBe('');
  });

  it('has no condition for the legacy basic card below the ladder', () => {
    expect(songGradeCondition(-1, rule).full).toBe('');
  });
});
