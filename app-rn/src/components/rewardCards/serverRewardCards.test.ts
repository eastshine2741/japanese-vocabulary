import { describe, expect, it, vi } from 'vitest';

vi.mock('../songDetail/songCardSample', () => ({
  toCardLine: (line: { index: number; originalText: string; koreanLyrics: string | null }) => ({
    index: line.index,
    ruby: [{ text: line.originalText }],
    ko: line.koreanLyrics ?? '',
  }),
}));

import type { ArtistCardDto, SongCardDto } from '../../types/rewardCard';
import { artistGradeFrom, kstDate, serverTargetId, songGradeOf, toArtistCard, toRevealTarget, toSongCard } from './serverRewardCards';

const songDto = (over: Partial<SongCardDto> = {}): SongCardDto => ({
  id: 90,
  songId: 12,
  title: '群青',
  artist: 'YOASOBI',
  artworkUrl: null,
  artistId: 3,
  grade: 'SILVER',
  acquiredSeq: 41,
  lyricLineIndexes: [],
  lyric: [{ index: 4, originalText: '青い', startTimeMs: null, koreanLyrics: '푸른', tokens: [] }],
  words: [{ japanese: '波', reading: 'ナミ', meaning: '파도' }],
  recall: 0.82,
  goals: [{ grade: 'SILVER', current: 3, total: 9 }],
  signature: [],
  issued: true,
  createdAt: '2026-10-10T16:30:00Z',
  ...over,
});

describe('serverRewardCards', () => {
  it('maps a song card to the card model', () => {
    const card = toSongCard(songDto());
    expect(card.id).toBe('srv-song-90');
    expect(card).toMatchObject({ songId: 12, issued: true, level: 2, mastered: false, ownerNo: 41, recall: 0.82, artworkUrl: '', signature: null });
    // 16:30 UTC 는 KST 로 다음 날이다.
    expect(card.earnedAt).toBe('2026-10-11');
    expect(card.words[0].reading).toBe('なみ');
    expect(card.lyric.map((line) => line.index)).toEqual([4]);
  });

  it('master is level 3 with the mastered front and keeps the signature', () => {
    const card = toSongCard(songDto({ grade: 'MASTER', signature: ['M 0 0'] }));
    expect(card).toMatchObject({ level: 3, mastered: true, signature: ['M 0 0'] });
  });

  it('maps an artist card counting mastered songs', () => {
    const dto: ArtistCardDto = {
      id: 55,
      artistId: 3,
      name: 'YOASOBI',
      artworkUrl: 'a.jpg',
      grade: 'BRONZE',
      acquiredSeq: 7,
      fanNo: 7,
      signature: [],
      issued: false,
      masteredSongs: [{ songId: 12, title: '群青', artworkUrl: null }],
      createdAt: '2026-10-01T00:00:00Z',
    };
    expect(toArtistCard(dto)).toMatchObject({
      id: 'srv-artist-55',
      artistId: 3,
      masteredCount: 1,
      issued: false,
      ownerNo: 7,
      fanNo: 7,
      since: '2026-10-01',
      masteredSongs: [{ title: '群青', artworkUrl: '' }],
    });
  });

  it('an artist card keeps its grade material even if mastered songs are missing', () => {
    const dto: ArtistCardDto = {
      id: 56, artistId: 3, name: 'YOASOBI', artworkUrl: null, grade: 'SILVER', acquiredSeq: 1, fanNo: 9,
      signature: [], issued: true, masteredSongs: [], createdAt: '2026-10-01T00:00:00Z',
    };
    expect(toArtistCard(dto)).toMatchObject({ masteredCount: 3, ownerNo: 1, fanNo: 9 });
  });

  it('reveal targets point at the card of that grade', () => {
    expect(toRevealTarget({ kind: 'SONG', cardId: 90, targetId: 12, grade: 'GOLD', acquiredSeq: 1 })).toEqual({
      kind: 'song', cardId: 'srv-song-90', server: true,
    });
    expect(toRevealTarget({ kind: 'ARTIST', cardId: 55, targetId: 3, grade: 'BASIC', acquiredSeq: 1 })).toMatchObject({
      kind: 'artist', cardId: 'srv-artist-55',
    });
  });

  it('server ids never collide with dummy ids', () => {
    expect(serverTargetId('srv-song-90')).toBe(90);
    expect(serverTargetId('artist-3')).toBeNull();
    expect(serverTargetId('lemon')).toBeNull();
  });

  it('grade helpers', () => {
    expect(songGradeOf('BASIC')).toEqual({ level: 0, mastered: false });
    expect(artistGradeFrom('GOLD')).toBe(7);
    expect(kstDate('2026-01-01T14:59:59Z')).toBe('2026-01-01');
  });
});
