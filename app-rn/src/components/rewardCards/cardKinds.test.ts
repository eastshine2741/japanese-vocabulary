import { describe, expect, it } from 'vitest';
import { ARTIST_GRADE_STEPS } from './artistGrade';
import {
  SONG_CARD_KINDS,
  artistCardOfStep,
  artistCardSample,
  artistCardStacks,
  artistCardsOf,
  findSongCard,
  songCardOfKind,
  songCardSample,
  songCardStacks,
  songCardsOf,
} from './cardKinds';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

function songCard(id: string, title: string, level: CardLevel, mastered = false): SongRewardCard {
  return {
    id, songId: null, title, artist: 'A', artworkUrl: '', accent: '', ink: '', level, mastered,
    reviewedCount: 10, dueCount: 3, ownerNo: 1, earnedAt: '2026-10-01', lyric: [], signature: null, words: [], goals: {},
  };
}

function artistCard(id: string, masteredCount: number): ArtistRewardCard {
  return {
    id, artistId: null, name: 'A', imageUrl: '', accent: '', ink: '', masteredCount, ownerNo: 1, fanNo: masteredCount >= 1 ? 1 : null, since: '2026-10-01',
    masteredSongs: Array.from({ length: masteredCount }, (_, i) => ({ title: `곡${i}`, artworkUrl: '' })),
    signature: null,
  };
}

describe('곡 카드 종류', () => {
  const cards = [songCard('b0', '곡', 0), songCard('b1', '곡', 1), songCard('m', '곡', 3, true), songCard('x', '다른 곡', 2)];

  it('등급마다 받은 카드가 따로 있고, 없는 등급은 null 이다', () => {
    const mine = songCardsOf(cards, null, '곡');
    expect(SONG_CARD_KINDS.map(kind => songCardOfKind(mine, kind)?.id ?? null)).toEqual(['b0', 'b1', null, null, 'm']);
  });

  it('가장 높은 등급 카드를 고른다', () => {
    expect(findSongCard(cards, 1, '곡')?.id).toBe('m');
    expect(findSongCard(cards, 1, '없는 곡')).toBeNull();
  });

  it('견본은 그 등급으로 돌리고 새것으로 비운다', () => {
    expect(songCardSample(cards[0], SONG_CARD_KINDS[3])).toMatchObject({ id: 'b0', level: 3, mastered: false, sample: true, reviewedCount: 0, dueCount: 0 });
  });
});

describe('아티스트 카드 등급', () => {
  it('등급마다 받은 카드가 따로 있다', () => {
    const mine = artistCardsOf([artistCard('p', 0), artistCard('s', 4)], null, 'A');
    expect(ARTIST_GRADE_STEPS.map(step => artistCardOfStep(mine, step)?.id ?? null)).toEqual(['p', null, 's', null, null, null]);
  });

  it('견본은 그 등급이 되는 마스터 곡 수로 돌린다', () => {
    expect(artistCardSample(artistCard('s', 4), ARTIST_GRADE_STEPS[3])).toMatchObject({ masteredCount: 7, sample: true });
  });

  it('기본 카드로 만든 BRONZE 이상 견본에도 팬 번호 자리가 있다', () => {
    const basic = { ...artistCard('s', 0), fanNo: null };
    expect(artistCardSample(basic, ARTIST_GRADE_STEPS[1]).fanNo).not.toBeNull();
    expect(artistCardSample(artistCard('s', 4), ARTIST_GRADE_STEPS[0]).fanNo).toBeNull();
  });
});

describe('보관함 칸 묶기', () => {
  it('곡마다 한 칸으로 묶고 가장 높은 등급 카드를 위에 올린다', () => {
    const stacks = songCardStacks([
      songCard('a0', 'A', 0),
      songCard('b0', 'B', 0),
      songCard('a3m', 'A', 3, true),
      songCard('a1', 'A', 1),
    ]);
    expect(stacks.map((s) => [s.top.id, s.count])).toEqual([['a3m', 3], ['b0', 1]]);
  });

  it('아티스트마다 한 칸으로 묶고 가장 높은 등급 카드를 위에 올린다', () => {
    const top = artistCard('x-gold', ARTIST_GRADE_STEPS[2].from);
    const stacks = artistCardStacks([artistCard('x-basic', 0), top]);
    expect(stacks).toEqual([{ top, count: 2 }]);
  });
});
