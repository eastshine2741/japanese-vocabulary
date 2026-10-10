import { describe, expect, it } from 'vitest';
import { DUMMY_ARTIST_CARDS, DUMMY_SONG_CARDS } from './dummyRewardCards';
import { artistRung, previousArtistCard, previousSongCard, songRung } from './cardUpgrade';
import { spreadReach } from './spreadLayer';

const song = DUMMY_SONG_CARDS[0];
const artist = DUMMY_ARTIST_CARDS[0];

describe('previousSongCard', () => {
  it('마스터 카드는 마스터 전 완곡 카드에서 오른다', () => {
    const prev = previousSongCard({ ...song, level: 3, mastered: true });
    expect(prev).toMatchObject({ level: 3, mastered: false });
    expect(songRung(prev!)).toBe(3);
  });

  it('레벨 카드는 한 레벨 아래에서 오른다', () => {
    expect(previousSongCard({ ...song, level: 2, mastered: false })).toMatchObject({ level: 1 });
  });

  it('기본 카드는 오른 적이 없다', () => {
    expect(previousSongCard({ ...song, level: 0, mastered: false })).toBeNull();
  });
});

describe('previousArtistCard', () => {
  it('지금 재질이 시작되는 곡 수에서 한 곡 모자라 한 칸 아래 재질이다', () => {
    const card = { ...artist, masteredCount: 4 };
    const prev = previousArtistCard(card)!;
    expect(prev.masteredCount).toBe(2);
    expect(artistRung(prev)).toBe(artistRung(card) - 1);
  });

  it('기본 재질은 오른 적이 없다', () => {
    expect(previousArtistCard({ ...artist, masteredCount: 0 })).toBeNull();
  });
});

describe('spreadReach', () => {
  it('박힌 자리에서 가장 먼 모서리까지 닿는다', () => {
    expect(spreadReach(100, 140, { x: 90, y: 130 })).toBeCloseTo(Math.hypot(90, 130));
    expect(spreadReach(100, 140, { x: 50, y: 70 })).toBeCloseTo(Math.hypot(50, 70));
  });
});
