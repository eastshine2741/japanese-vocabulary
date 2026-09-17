import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SongAnalysisWorkResponse } from '../types/song';

const getAnalysisWork = vi.fn<(workId: number) => Promise<SongAnalysisWorkResponse>>();

vi.mock('../api/songApi', () => ({ songApi: { getAnalysisWork: (id: number) => getAnalysisWork(id) } }));
vi.mock('../utils/preferenceStorage', () => ({
  preferenceStorage: { getAnalysisPillDock: async () => null, saveAnalysisPillDock: async () => undefined },
}));
vi.mock('./songDetailStore', () => ({
  useSongDetailStore: { getState: () => ({ data: null, refreshWords: async () => undefined }) },
}));

const { useAnalysisStore, isAnalyzingSong } = await import('./analysisStore');

const work = (over: Partial<SongAnalysisWorkResponse> = {}): SongAnalysisWorkResponse => ({
  workId: 1,
  status: 'RUNNING',
  currentStage: null,
  songId: null,
  canOpenPlayer: false,
  isAnalysisComplete: false,
  errorCode: null,
  errorMessage: null,
  ...over,
});

const song = { title: '夜に駆ける', artist: 'YOASOBI', artworkUrl: null };

describe('analysisStore polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getAnalysisWork.mockReset();
    getAnalysisWork.mockImplementation(async id => work({ workId: id }));
  });
  afterEach(() => {
    useAnalysisStore.getState().reset();
    vi.useRealTimers();
  });

  it('tracking the same work twice keeps one job and one polling loop', async () => {
    const store = useAnalysisStore.getState();
    const first = store.track(work(), song);
    const second = store.track(work(), song);

    expect(second).toBe(first);
    expect(useAnalysisStore.getState().jobs).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3000 * 2);
    expect(getAnalysisWork).toHaveBeenCalledTimes(2);
  });

  it('readyFor joins the in-flight analysis of the same song and resolves with it', async () => {
    const store = useAnalysisStore.getState();
    const tracked = store.track(work(), song);

    const joined = store.readyFor(song.title, song.artist);
    expect(joined).toBe(tracked);
    expect(store.readyFor('다른 곡', song.artist)).toBeNull();
    expect(isAnalyzingSong(useAnalysisStore.getState().jobs, song.title, song.artist)).toBe(true);

    getAnalysisWork.mockResolvedValue(work({ songId: 7, canOpenPlayer: true }));
    await vi.advanceTimersByTimeAsync(3000);
    await expect(joined).resolves.toMatchObject({ songId: 7 });
  });

  it('stops matching once the song is done', async () => {
    const store = useAnalysisStore.getState();
    store.track(work({ songId: 7, canOpenPlayer: true, isAnalysisComplete: true }), song);

    expect(isAnalyzingSong(useAnalysisStore.getState().jobs, song.title, song.artist)).toBe(false);
    expect(store.readyFor(song.title, song.artist)).toBeNull();
    expect(getAnalysisWork).not.toHaveBeenCalled();
  });
});
