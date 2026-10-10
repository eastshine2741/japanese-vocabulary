import { describe, expect, it } from 'vitest';
import { sortCards, wearAge, wearState } from './cardWear';
import { SongRewardCard } from './types';

function card(id: string, patch: Partial<SongRewardCard>): SongRewardCard {
  return {
    id,
    songId: null,
    title: id,
    artist: '',
    artworkUrl: '',
    accent: '#000000',
    ink: '#000000',
    level: 1,
    mastered: false,
    recall: 0.95,
    ownerNo: 1,
    earnedAt: '2026-10-01',
    frontLines: ['', ''],
    backLines: [],
    backKo: '',
    words: [],
    nextGoal: null,
    ...patch,
  };
}

describe('wearAge', () => {
  it('목표 기억률 이상이면 새것이다', () => {
    expect(wearAge(0.97)).toBe(0);
    expect(wearAge(0.9)).toBe(0);
  });

  it('0.5 이하에서 끝까지 낡는다', () => {
    expect(wearAge(0.7)).toBeCloseTo(0.5);
    expect(wearAge(0.3)).toBe(1);
  });
});

describe('wearState', () => {
  it('기억 확률 구간으로 나눈다', () => {
    expect(wearState(0.92)).toBe('fresh');
    expect(wearState(0.85)).toBe('faded');
    expect(wearState(0.7)).toBe('worn');
    expect(wearState(0.5)).toBe('tattered');
  });
});

describe('sortCards', () => {
  const cards = [
    card('a', { level: 3, earnedAt: '2026-09-01' }),
    card('b', { level: 3, mastered: true, earnedAt: '2026-08-01' }),
    card('c', { level: 1, recall: 0.6, earnedAt: '2026-10-05' }),
    card('d', { level: 2, recall: 0.8, earnedAt: '2026-09-20' }),
  ];

  it('레벨순은 마스터 카드를 3레벨보다 앞에 둔다', () => {
    expect(sortCards(cards, 'level').map((c) => c.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('최근순은 획득일 역순이다', () => {
    expect(sortCards(cards, 'recent').map((c) => c.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('낡은순은 기억 확률이 낮은 카드부터다', () => {
    expect(sortCards(cards, 'worn').map((c) => c.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});
