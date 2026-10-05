import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SongAnalysisWorkResponse } from '../types/song';

const getAnalysisWork = vi.fn<(workId: number) => Promise<SongAnalysisWorkResponse>>();

vi.mock('../api/songApi', () => ({ songApi: { getAnalysisWork: (id: number) => getAnalysisWork(id) } }));
vi.mock('../utils/preferenceStorage', () => ({
  preferenceStorage: { getAnalysisPillDock: async () => null, saveAnalysisPillDock: async () => undefined },
}));
const trackSongAnalyzeResult = vi.fn();
vi.mock('../services/analytics', () => ({
  trackSongAnalyzeResult: (outcome: string) => trackSongAnalyzeResult(outcome),
  analyzeOutcomeOf: (code: string | null) => (code === 'LYRICS_NOT_FOUND' ? 'lyrics_not_found' : 'failed'),
}));
const refreshWords = vi.fn(async (_songId: number) => undefined);
const refreshTiers = vi.fn(async (_songId: number) => undefined);
const refreshCoverage = vi.fn(async (_songId: number) => undefined);
let songDetailData: { song: { id: number } } | null = null;
vi.mock('./songDetailStore', () => ({
  useSongDetailStore: { getState: () => ({ data: songDetailData, refreshWords, refreshTiers, refreshCoverage }) },
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
    trackSongAnalyzeResult.mockClear();
    refreshWords.mockClear();
    refreshTiers.mockClear();
    refreshCoverage.mockClear();
    songDetailData = null;
  });
  afterEach(() => {
    useAnalysisStore.getState().reset();
    vi.useRealTimers();
  });

  it('tracking the same work twice keeps one job and one polling loop', async () => {
    const store = useAnalysisStore.getState();
    store.track(work(), song);
    store.track(work(), song);

    expect(useAnalysisStore.getState().jobs).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3000 * 2);
    expect(getAnalysisWork).toHaveBeenCalledTimes(2);
  });

  it('keeps the song closed until analysis completes, then offers it from the pill', async () => {
    useAnalysisStore.getState().track(work(), song);
    expect(isAnalyzingSong(useAnalysisStore.getState().jobs, song.title, song.artist)).toBe(true);
    expect(isAnalyzingSong(useAnalysisStore.getState().jobs, '다른 곡', song.artist)).toBe(false);

    getAnalysisWork.mockResolvedValue(work({ status: 'COMPLETED', songId: 7, canOpenPlayer: true, isAnalysisComplete: true }));
    await vi.advanceTimersByTimeAsync(3000);

    expect(useAnalysisStore.getState().jobs[0]).toMatchObject({ phase: 'done', songId: 7 });
    expect(trackSongAnalyzeResult).toHaveBeenCalledWith('success');
  });

  it('keeps a finished job until it is dismissed, but drops a failed one after the hold', async () => {
    const store = useAnalysisStore.getState();
    store.track(work({ workId: 1, status: 'COMPLETED', songId: 7, isAnalysisComplete: true }), song);
    store.track(work({ workId: 2 }), { ...song, title: '群青' });
    getAnalysisWork.mockResolvedValue(work({ workId: 2, status: 'FAILED' }));
    await vi.advanceTimersByTimeAsync(3000 * 10);

    expect(useAnalysisStore.getState().jobs.map(j => j.workId)).toEqual([1]);
    store.dismiss(1);
    expect(useAnalysisStore.getState().jobs).toHaveLength(0);
  });

  it('marks the job failed with the reason the server gave', async () => {
    useAnalysisStore.getState().track(work(), song);
    getAnalysisWork.mockResolvedValue(work({ status: 'FAILED', errorCode: 'LYRICS_NOT_FOUND' }));
    await vi.advanceTimersByTimeAsync(3000);

    expect(useAnalysisStore.getState().jobs[0]).toMatchObject({ phase: 'failed', errorCode: 'LYRICS_NOT_FOUND' });
    expect(trackSongAnalyzeResult).toHaveBeenCalledWith('lyrics_not_found');
  });

  it('refreshes words, tiers and coverage of the song detail already open when analysis completes', async () => {
    songDetailData = { song: { id: 7 } };
    useAnalysisStore.getState().track(work({ songId: 7, canOpenPlayer: true, isAnalysisComplete: true }), song);
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshWords).toHaveBeenCalledWith(7);
    expect(refreshTiers).toHaveBeenCalledWith(7);
    expect(refreshCoverage).toHaveBeenCalledWith(7);
  });

  it('leaves the song detail alone when it shows a different song', async () => {
    songDetailData = { song: { id: 8 } };
    useAnalysisStore.getState().track(work({ songId: 7, canOpenPlayer: true, isAnalysisComplete: true }), song);
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshWords).not.toHaveBeenCalled();
    expect(refreshTiers).not.toHaveBeenCalled();
    expect(refreshCoverage).not.toHaveBeenCalled();
  });

  it('stops matching once the song is done', async () => {
    const store = useAnalysisStore.getState();
    store.track(work({ songId: 7, canOpenPlayer: true, isAnalysisComplete: true }), song);

    expect(isAnalyzingSong(useAnalysisStore.getState().jobs, song.title, song.artist)).toBe(false);
    expect(getAnalysisWork).not.toHaveBeenCalled();
  });
});
