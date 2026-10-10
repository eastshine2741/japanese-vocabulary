import { describe, expect, it } from 'vitest';
import { ARTIST_GRADE_STEPS } from './artistGrade';
import { SONG_CARD_KINDS, artistCardAt, findSongCard, ownsArtistGrade, ownsSongKind, songCardAt } from './cardKinds';
import type { ArtistRewardCard, CardLevel, SongRewardCard } from './types';

function songCard(id: string, title: string, level: CardLevel, mastered = false): SongRewardCard {
  return {
    id, songId: null, title, artist: 'A', artworkUrl: '', accent: '', ink: '', level, mastered,
    recall: 1, ownerNo: 1, earnedAt: '2026-10-01', lyric: [], signature: null, words: [], nextGoal: null,
  };
}

function artistCard(masteredCount: number): ArtistRewardCard {
  return {
    id: 'a', artistId: null, name: 'A', imageUrl: '', accent: '', ink: '', masteredCount, fanNo: 1, since: '2026-10-01',
    masteredSongs: Array.from({ length: masteredCount }, (_, i) => ({ title: `곡${i}`, artworkUrl: '' })),
    signature: null,
  };
}

describe('곡 카드 종류', () => {
  it('레벨 2 카드는 기본·BRONZE·SILVER 를 가졌고 GOLD·MASTER 는 아직이다', () => {
    const card = songCard('c', '곡', 2);
    expect(SONG_CARD_KINDS.map(kind => ownsSongKind(card, kind))).toEqual([true, true, true, false, false]);
  });

  it('마스터 카드는 모든 종류를 가졌다', () => {
    const card = songCard('c', '곡', 3, true);
    expect(SONG_CARD_KINDS.every(kind => ownsSongKind(card, kind))).toBe(true);
  });

  it('지나온 종류는 내 카드를 그 레벨로 돌리고, 지금 종류는 카드 그대로다', () => {
    const card = songCard('c', '곡', 3, true);
    expect(songCardAt(card, SONG_CARD_KINDS[1])).toMatchObject({ id: 'c', level: 1, mastered: false });
    expect(songCardAt(card, SONG_CARD_KINDS[4])).toBe(card);
  });

  it('같은 곡 카드가 여럿이면 마스터, 그다음 레벨 높은 카드를 고른다', () => {
    const cards = [songCard('a', '곡', 3), songCard('b', '곡', 1, true), songCard('c', '다른 곡', 3, true)];
    expect(findSongCard(cards, 1, '곡')?.id).toBe('b');
    expect(findSongCard(cards, 1, '없는 곡')).toBeNull();
  });
});

describe('아티스트 카드 재질', () => {
  it('마스터 곡 수가 닿은 재질까지 가졌다', () => {
    const card = artistCard(3);
    expect(ARTIST_GRADE_STEPS.map(step => ownsArtistGrade(card, step))).toEqual([true, true, true, false, false, false]);
    expect(ARTIST_GRADE_STEPS.some(step => ownsArtistGrade(null, step))).toBe(false);
  });

  it('지나온 재질은 그 재질이 되던 마스터 곡 수로 돌린다', () => {
    const card = artistCard(4);
    expect(artistCardAt(card, ARTIST_GRADE_STEPS[1])).toMatchObject({ masteredCount: 1 });
    expect(artistCardAt(card, ARTIST_GRADE_STEPS[1]).masteredSongs).toHaveLength(1);
    expect(artistCardAt(card, ARTIST_GRADE_STEPS[2])).toBe(card);
  });
});
