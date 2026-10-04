import { describe, expect, it } from 'vitest';
import { cumulativeBacklog, estimateMinutes } from './scheduleMath';
import { ScheduleForecastDay } from '../../types/studySchedule';

const day = (scheduledDue: number): ScheduleForecastDay => ({
  date: '2026-10-04',
  scheduledDue,
  simulatedReview: 0,
});

describe('estimateMinutes', () => {
  it('0장은 0분', () => {
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(-3)).toBe(0);
  });

  it('1장이라도 있으면 최소 1분', () => {
    expect(estimateMinutes(1)).toBe(1);
  });

  it('25초/장을 분으로 반올림한다', () => {
    expect(estimateMinutes(17)).toBe(7);
    expect(estimateMinutes(40)).toBe(17);
  });
});

describe('cumulativeBacklog', () => {
  it('날짜별 due 를 누적한다', () => {
    expect(cumulativeBacklog([day(17), day(6), day(0), day(12)])).toEqual([17, 23, 23, 35]);
  });

  it('빈 배열은 빈 배열', () => {
    expect(cumulativeBacklog([])).toEqual([]);
  });
});
