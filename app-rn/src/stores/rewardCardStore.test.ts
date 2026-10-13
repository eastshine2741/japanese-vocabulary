import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/rewardCardApi', () => ({
  rewardCardApi: {
    getCards: vi.fn(),
    getPending: vi.fn(),
    issueSongCard: vi.fn(),
    issueArtistCard: vi.fn(),
    updateSongCardLyric: vi.fn(),
  },
}));
vi.mock('../api/songApi', () => ({ songApi: { getLyrics: vi.fn() } }));
vi.mock('../utils/preferenceStorage', () => ({
  preferenceStorage: { getCardWearIntroSeen: vi.fn(async () => false), saveCardWearIntroSeen: vi.fn(async () => undefined) },
}));
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
  id: 90, songId: 12, title: '群青', artist: 'YOASOBI', artworkUrl: null, artistId: null, grade: 'BASIC',
  acquiredSeq: 1, lyricLineIndexes: [], lyric: [], words: [], recall: 1, nextGoal: null, signature: [],
  issued: false, createdAt: '2026-10-11T00:00:00Z', ...over,
});

describe('rewardCardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.issueSongCard.mockResolvedValue();
    api.updateSongCardLyric.mockResolvedValue();
  });
  afterEach(() => store().reset());

  it('rating reveals reload cards and open one at a time', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto()], artistCards: [] });

    await store().receiveReveals([
      { kind: 'SONG', cardId: 90, targetId: 12, grade: 'BASIC', acquiredSeq: 1 },
      { kind: 'ARTIST', cardId: 30, targetId: 3, grade: 'BASIC', acquiredSeq: 1 },
    ]);

    expect(store().songCards.map((c) => c.id)).toEqual(['srv-song-90']);
    expect(store().openNextReveal()?.cardId).toBe('srv-song-90');
    expect(store().openNextReveal()).toBeNull();
    store().closeReveal();
    expect(store().openNextReveal()?.cardId).toBe('srv-artist-30');
  });

  it('signing a server reveal issues the card with the picked lines', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto()], artistCards: [] });
    await store().receiveReveals([{ kind: 'SONG', cardId: 90, targetId: 12, grade: 'BASIC', acquiredSeq: 1 }]);
    store().openNextReveal();

    store().setLyric('srv-song-90', [3]);
    expect(api.updateSongCardLyric).not.toHaveBeenCalled();
    store().sign('song', 'srv-song-90', ['M 0 0']);

    expect(api.issueSongCard).toHaveBeenCalledWith(90, ['M 0 0'], [3]);
    expect(store().songCards[0].signature).toEqual(['M 0 0']);
  });

  it('a new grade of an owned song is its own card with its own reveal', async () => {
    api.getCards.mockResolvedValue({
      songCards: [songDto({ id: 91, grade: 'BRONZE' }), songDto({ issued: true, signature: ['M'] })],
      artistCards: [],
    });
    await store().receiveReveals([{ kind: 'SONG', cardId: 91, targetId: 12, grade: 'BRONZE', acquiredSeq: 4 }]);
    store().openNextReveal();

    store().sign('song', 'srv-song-91', ['N']);

    expect(api.issueSongCard).toHaveBeenCalledWith(91, ['N'], []);
    expect(store().songCards.find((c) => c.id === 'srv-song-90')?.signature).toEqual(['M']);
  });

  it('editing lyric of an issued card saves it', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ signature: ['M'] })], artistCards: [] });
    await store().loadServerCards();

    store().setLyric('srv-song-90', [1, 2]);

    expect(api.updateSongCardLyric).toHaveBeenCalledWith(90, [1, 2]);
  });

  it('lyric edit of a card issued without a reveal saves it though unsigned', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ issued: true })], artistCards: [] });
    await store().loadServerCards();

    store().setLyric('srv-song-90', [3]);
    expect(api.updateSongCardLyric).toHaveBeenCalledWith(90, [3]);
  });

  it('dev re-reveal never calls the server', async () => {
    api.getCards.mockResolvedValue({ songCards: [songDto({ signature: ['M'] })], artistCards: [] });
    await store().loadServerCards();

    store().revealCard('song', 'srv-song-90');
    store().openNextReveal();
    store().sign('song', 'srv-song-90', ['N']);

    expect(api.issueSongCard).not.toHaveBeenCalled();
  });

  it('dummy source shows dummy cards and ignores server reveals', async () => {
    store().setSource('dummy');
    expect(store().songCards.map((c) => c.id)).toEqual(['lemon']);

    await store().receiveReveals([{ kind: 'SONG', cardId: 90, targetId: 12, grade: 'BASIC', acquiredSeq: 1 }]);

    expect(api.getCards).not.toHaveBeenCalled();
    expect(store().queue).toEqual([]);
  });
});
