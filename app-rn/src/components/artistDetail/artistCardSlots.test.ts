import { describe, expect, it } from 'vitest';
import type { SongRewardCard } from '../rewardCards/types';
import type { ArtistDetail } from '../../types/artist';
import { buildSongCardSlots, chunk } from './artistCardSlots';

function card(id: string, title: string, level: 1 | 2 | 3, mastered = false): SongRewardCard {
  return {
    id, songId: null, title, artist: 'A', artworkUrl: '', accent: '', ink: '', level, mastered,
    recall: 1, ownerNo: 1, earnedAt: '2026-10-01', lyric: [], signature: null, words: [], nextGoal: null,
  };
}

const artist: ArtistDetail = {
  id: 1,
  name: 'A',
  artworkUrl: null,
  appleMusicUrl: null,
  studyingSongs: [
    { songId: 10, title: '곡1', artworkUrl: null, totalLines: 10, knownLines: 5 },
    { songId: 11, title: '곡2', artworkUrl: null, totalLines: 10, knownLines: 1 },
  ],
  popularSongs: [{ id: 'p1', title: '곡3' } as ArtistDetail['popularSongs'][number]],
};

describe('buildSongCardSlots', () => {
  it('얻은 카드는 마스터·레벨 높은 순으로 앞에 두고, 카드가 없는 곡만 빈칸으로 남긴다', () => {
    const slots = buildSongCardSlots(artist, [card('a', '곡1', 1), card('b', '곡4', 3, true)]);
    expect(slots.map(slot => slot.key)).toEqual(['card-b', 'card-a', 'studying-11', 'popular-p1']);
  });
});

describe('chunk', () => {
  it('마지막 줄은 모자란 채로 둔다', () => {
    expect(chunk([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
  });
});
