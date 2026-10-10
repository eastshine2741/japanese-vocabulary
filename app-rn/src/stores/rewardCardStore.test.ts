import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/rewardCardApi', () => ({
  rewardCardApi: {
    getCards: vi.fn(),
    getPending: vi.fn(),
    issueSongCard: vi.fn(),
    issueArtistCard: vi.fn(),
    markSongCardSeen: vi.fn(),
    markArtistCardSeen: vi.fn(),
    updateSongCardLyric: vi.fn(),
  },
}));
vi.mock('../api/songApi', () => ({ songApi: { getLyrics: vi.fn() } }));
vi.mock('../components/rewardCards/dummyRewardCards', () => ({
  DUMMY_SONG_CARDS: [{ id: 'lemon', songId: null, signature: null, lyric: [] }],
  DUMMY_ARTIST_CARDS: [],
  findDummyLyrics: () => [],
}));
vi.mock('../components/songDetail/songCardSample', () => ({
  toCardLine: (line: { index: number }) => ({ index: line.index, ruby: [], ko: '' }),
}));

import { rewardCardApi } from '../api/rewardCardApi';
import type { SongCardDto } from '../types/rewardCard';
import { useRewardCardStore } from './rewardCardStore';

const api = vi.mocked(rewardCardApi);
const store = () => useRewardCardStore.getState();

const songDto = (over: Partial<SongCardDto> = {}): SongCardDto => ({
  songId: 12, title: '群青', artist: 'YOASOBI', artworkUrl: null, artistId: null, grade: 'BASIC', seenGrade: null,
  acquiredSeq: 1, lyricLineIndexes: [], lyric: [], words: [], recall: 1, nextGoal: null, signature: [],
  masteredAt: null, createdAt: '2026-10-11T00:00:00Z', ...over,
});

describe('rewardCardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.issueSongCard.mockResolvedValue();
    api.markSongCardSeen.mockResolvedValue();
    api.updateSongCardLyric.mockResolvedValue();
  });
  afterEach(() => store().reset());

  it('rating reveals reload cards and open one at a time', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto()], artistCards: [] });

    await store().receiveReveals([
      { kind: 'SONG', targetId: 12, grade: 'BASIC', seenGrade: null, acquiredSeq: 1 },
      { kind: 'ARTIST', targetId: 3, grade: 'BASIC', seenGrade: null, acquiredSeq: 1 },
    ]);

    expect(store().songCards.map((c) => c.id)).toEqual(['srv-song-12']);
    expect(store().openNextReveal()?.cardId).toBe('srv-song-12');
    expect(store().openNextReveal()).toBeNull();
    store().closeReveal();
    expect(store().openNextReveal()?.cardId).toBe('srv-artist-3');
  });

  it('signing a server reveal issues the card with the picked lines', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto()], artistCards: [] });
    await store().receiveReveals([{ kind: 'SONG', targetId: 12, grade: 'BASIC', seenGrade: null, acquiredSeq: 1 }]);
    store().openNextReveal();

    store().setLyric('srv-song-12', [3]);
    expect(api.updateSongCardLyric).not.toHaveBeenCalled();
    store().sign('song', 'srv-song-12', ['M 0 0']);

    expect(api.issueSongCard).toHaveBeenCalledWith(12, ['M 0 0'], [3]);
    expect(store().songCards[0].signature).toEqual(['M 0 0']);
  });

  it('closing an upgrade marks the grade seen', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ grade: 'GOLD', seenGrade: 'BRONZE', signature: ['M'] })], artistCards: [] });
    await store().receiveReveals([{ kind: 'SONG', targetId: 12, grade: 'GOLD', seenGrade: 'BRONZE', acquiredSeq: 1 }]);
    expect(store().openNextReveal()).toMatchObject({ upgrade: true, fromGrade: 'BRONZE' });

    store().closeReveal();

    expect(api.markSongCardSeen).toHaveBeenCalledWith(12, 'GOLD');
  });

  it('editing lyric of an issued card saves it', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ signature: ['M'] })], artistCards: [] });
    await store().loadServerCards();

    store().setLyric('srv-song-12', [1, 2]);

    expect(api.updateSongCardLyric).toHaveBeenCalledWith(12, [1, 2]);
  });

  it('dev re-reveal never calls the server', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ signature: ['M'] })], artistCards: [] });
    await store().loadServerCards();

    store().revealCard('song', 'srv-song-12');
    store().openNextReveal();
    store().sign('song', 'srv-song-12', ['N']);

    expect(api.issueSongCard).not.toHaveBeenCalled();
  });

  it('dummy source shows dummy cards and ignores server reveals', async () => {
    store().setSource('dummy');
    expect(store().songCards.map((c) => c.id)).toEqual(['lemon']);

    await store().receiveReveals([{ kind: 'SONG', targetId: 12, grade: 'BASIC', seenGrade: null, acquiredSeq: 1 }]);

    expect(api.getCards).not.toHaveBeenCalled();
    expect(store().queue).toEqual([]);
  });
});
