import { describe, expect, it } from 'vitest';
import { dueRatio, sortCards, wearAge, wearState } from './cardWear';
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
    reviewedCount: 10,
    dueCount: 0,
    ownerNo: 1,
    earnedAt: '2026-10-01',
    lyric: [],
    signature: null,
    words: [],
    goals: {},
    ...patch,
  };
}

describe('dueRatio', () => {
  it('받은 뒤 리뷰한 단어 중 복습할 차례인 비율이다', () => {
    expect(dueRatio({ reviewedCount: 20, dueCount: 5 })).toBe(0.25);
  });

  it('잴 단어가 없으면 0 이다', () => {
    expect(dueRatio({ reviewedCount: 0, dueCount: 0 })).toBe(0);
  });
});

describe('wearAge', () => {
  it('밀린 복습이 20% 아래면 새것이다', () => {
    expect(wearAge(0)).toBe(0);
    expect(wearAge(0.2)).toBe(0);
  });

  it('전부 밀리면 끝까지 낡는다', () => {
    expect(wearAge(0.6)).toBeCloseTo(0.5);
    expect(wearAge(1)).toBe(1);
  });
});

describe('wearState', () => {
  it('밀린 복습 비율 구간으로 나눈다', () => {
    expect(wearState(0.1)).toBe('fresh');
    expect(wearState(0.3)).toBe('faded');
    expect(wearState(0.7)).toBe('worn');
    expect(wearState(0.95)).toBe('tattered');
  });
});

describe('sortCards', () => {
  const cards = [
    card('a', { level: 3, earnedAt: '2026-09-01' }),
    card('b', { level: 3, mastered: true, earnedAt: '2026-08-01' }),
    card('c', { level: 1, dueCount: 6, earnedAt: '2026-10-05' }),
    card('d', { level: 2, dueCount: 3, earnedAt: '2026-09-20' }),
  ];

  it('등급순은 마스터 카드를 GOLD 보다 앞에 둔다', () => {
    expect(sortCards(cards, 'level').map((c) => c.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('획득순은 획득일 역순이다', () => {
    expect(sortCards(cards, 'recent').map((c) => c.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('낡은순은 밀린 복습 비율이 높은 카드부터다', () => {
    expect(sortCards(cards, 'worn').map((c) => c.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});
