import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKaraokeStore } from './karaokeStore';
import { karaokeApi } from '../api/karaokeApi';

vi.mock('../api/karaokeApi', () => ({
  karaokeApi: { getDaily: vi.fn(), getMonthly: vi.fn() },
}));

const store = () => useKaraokeStore.getState();
const group = (listedOn: string) => ({
  listedOn,
  songs: [{ title: '唱', artist: 'Ado', artworkUrl: null, tjNumber: 68455, kyNumber: null, songId: 1 }],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 11, 15));
  store().reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('daily', () => {
  it('이번 달을 읽는다', async () => {
    vi.mocked(karaokeApi.getDaily).mockResolvedValueOnce([group('2026-12-03')]);

    await store().loadDaily();

    expect(karaokeApi.getDaily).toHaveBeenCalledWith('2026-12');
    expect(store().daily.groups).toHaveLength(1);
    expect(store().daily.oldestMonth).toBe('2026-12');
  });

  it('이번 달이 비면 곡이 있는 이전 달까지 거슬러 올라간다', async () => {
    vi.mocked(karaokeApi.getDaily)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([group('2026-10-20')]);

    await store().loadDaily();

    expect(vi.mocked(karaokeApi.getDaily).mock.calls.map(c => c[0])).toEqual(['2026-12', '2026-11', '2026-10']);
    expect(store().daily.groups).toEqual([group('2026-10-20')]);
    expect(store().daily.exhausted).toBe(false);
  });

  it('빈 달이 이어지면 멈추고 더 읽지 않는다', async () => {
    vi.mocked(karaokeApi.getDaily).mockResolvedValue([]);

    await store().loadDaily();
    expect(store().daily.exhausted).toBe(true);

    vi.mocked(karaokeApi.getDaily).mockClear();
    await store().loadOlderDaily();
    expect(karaokeApi.getDaily).not.toHaveBeenCalled();
  });

  it('목록 끝에서 이전 달을 이어 붙인다', async () => {
    vi.mocked(karaokeApi.getDaily)
      .mockResolvedValueOnce([group('2026-12-03')])
      .mockResolvedValueOnce([group('2026-11-28')]);

    await store().loadDaily();
    await store().loadOlderDaily();

    expect(store().daily.groups.map(g => g.listedOn)).toEqual(['2026-12-03', '2026-11-28']);
    expect(store().daily.oldestMonth).toBe('2026-11');
  });

  it('이전 달을 읽는 중에 다시 읽으면 늦게 온 이전 달을 버려 같은 달이 두 번 붙지 않는다', async () => {
    vi.mocked(karaokeApi.getDaily).mockResolvedValueOnce([group('2026-12-03')]);
    await store().loadDaily();

    let resolveStale!: (v: ReturnType<typeof group>[]) => void;
    vi.mocked(karaokeApi.getDaily).mockReturnValueOnce(new Promise(r => { resolveStale = r; }));
    const stale = store().loadOlderDaily();

    vi.mocked(karaokeApi.getDaily)
      .mockResolvedValueOnce([group('2026-12-03')])
      .mockResolvedValueOnce([group('2026-11-28')]);
    await store().loadDaily();
    await store().loadOlderDaily();

    resolveStale([group('2026-11-28')]);
    await stale;

    expect(store().daily.groups.map(g => g.listedOn)).toEqual(['2026-12-03', '2026-11-28']);
    expect(store().daily.oldestMonth).toBe('2026-11');
  });

  it('다시 읽는 도중에 시작한 이전 달 요청도 버린다', async () => {
    vi.mocked(karaokeApi.getDaily).mockResolvedValueOnce([group('2026-12-03')]);
    await store().loadDaily();

    let resolveReload!: (v: ReturnType<typeof group>[]) => void;
    vi.mocked(karaokeApi.getDaily).mockReturnValueOnce(new Promise(r => { resolveReload = r; }));
    const reload = store().loadDaily();

    let resolveStale!: (v: ReturnType<typeof group>[]) => void;
    vi.mocked(karaokeApi.getDaily).mockReturnValueOnce(new Promise(r => { resolveStale = r; }));
    const stale = store().loadOlderDaily();

    resolveReload([group('2026-12-03')]);
    await reload;

    vi.mocked(karaokeApi.getDaily).mockResolvedValueOnce([group('2026-11-28')]);
    await store().loadOlderDaily();

    resolveStale([group('2026-11-28')]);
    await stale;

    expect(store().daily.groups.map(g => g.listedOn)).toEqual(['2026-12-03', '2026-11-28']);
  });

  it('다시 읽으면 새 목록으로 바꾸고, 실패하면 기존 목록을 둔다', async () => {
    vi.mocked(karaokeApi.getDaily)
      .mockResolvedValueOnce([group('2026-12-03')])
      .mockResolvedValueOnce([group('2026-12-04')])
      .mockRejectedValueOnce(new Error('boom'));

    await store().loadDaily();
    await store().loadDaily();
    expect(store().daily.groups.map(g => g.listedOn)).toEqual(['2026-12-04']);

    await store().loadDaily();
    expect(store().daily).toMatchObject({ status: 'success', error: 'boom' });
    expect(store().daily.groups.map(g => g.listedOn)).toEqual(['2026-12-04']);
  });
});

describe('monthly', () => {
  it('달을 옮기면 그 달을 읽는다', async () => {
    const monthly = { month: '2026-11', songCount: 2, artists: [] };
    vi.mocked(karaokeApi.getMonthly).mockResolvedValueOnce(monthly);

    await store().stepMonth(-1);

    expect(karaokeApi.getMonthly).toHaveBeenCalledWith('2026-11');
    expect(store().monthly).toMatchObject({ status: 'success', month: '2026-11', data: monthly });
  });
});
