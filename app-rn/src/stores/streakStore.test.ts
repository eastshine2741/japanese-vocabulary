import { afterEach, describe, expect, it, vi } from 'vitest';
import { streakCelebrationCopy, useStreakStore } from './streakStore';
import { studyStatsApi } from '../api/studyStatsApi';

vi.mock('../api/studyStatsApi', () => ({ studyStatsApi: { getHome: vi.fn() } }));

const store = () => useStreakStore.getState();

const WEEK = [
  { date: '2026-09-28', status: 'none' as const },
  { date: '2026-09-29', status: 'studied' as const },
  { date: '2026-09-30', status: 'studied' as const },
  { date: '2026-10-01', status: 'studied' as const },
  { date: '2026-10-02', status: 'freeze' as const },
  { date: '2026-10-03', status: 'studied' as const },
  { date: '2026-10-04', status: 'today' as const },
];

describe('streakCelebrationCopy (문구표)', () => {
  it('첫날: N=1, 이전 기록 없음', () => {
    expect(streakCelebrationCopy(1, false)).toEqual({
      headline: '첫 불꽃을 켰어요!',
      sub: '내일 한 번만 더 오면 2일 연속이에요',
    });
  });
  it('끊긴 뒤 재시작: N=1, 이전 기록 있음', () => {
    expect(streakCelebrationCopy(1, true)).toEqual({
      headline: '불꽃을 다시 켰어요!',
      sub: '내일 한 번만 더 오면 2일 연속이에요',
    });
  });
  it('이어감: N>=2 는 이전 기록과 무관', () => {
    const expected = { headline: '불꽃이 점점 커지고 있어요!', sub: '오늘도 해냈어요. 내일 이 자리에서 또 만나요' };
    expect(streakCelebrationCopy(4, true)).toEqual(expected);
    expect(streakCelebrationCopy(2, false)).toEqual(expected);
  });
});

describe('streakStore', () => {
  afterEach(() => store().reset());

  it('ensureLoaded: 아직 없으면 홈 통계를 받고, 이미 있으면 다시 받지 않는다', async () => {
    vi.mocked(studyStatsApi.getHome).mockResolvedValue({ currentStreak: 2, studiedToday: false, hasStudiedBefore: true, weekDots: WEEK } as any);
    await store().ensureLoaded();
    expect(store().loaded).toBe(true);
    expect(store().currentStreak).toBe(2);
    expect(store().weekDots).toEqual(WEEK);
    await store().ensureLoaded();
    expect(studyStatsApi.getHome).toHaveBeenCalledTimes(1);
  });

  it('ensureLoaded: 실패하면 그대로 미로딩 상태', async () => {
    vi.mocked(studyStatsApi.getHome).mockRejectedValueOnce(new Error('x'));
    await store().ensureLoaded();
    expect(store().loaded).toBe(false);
  });

  it('홈 통계를 받기 전에는 rating 이 아무것도 바꾸지 않는다', () => {
    store().recordRating();
    expect(store().celebration).toBeNull();
    expect(store().currentStreak).toBe(0);
    expect(store().studiedToday).toBe(false);
  });

  it('오늘 아직 → 첫 rating 에 숫자 +1, 축하 화면, 넛지 해제', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true, weekDots: WEEK });
    store().recordRating();
    expect(store().currentStreak).toBe(4);
    expect(store().studiedToday).toBe(true);
    expect(store().celebration).toEqual({
      ...streakCelebrationCopy(4, true),
      streak: 4,
      weekDots: WEEK,
    });
  });

  it('같은 날 두 번째 rating 부터는 축하 화면이 뜨지 않고 숫자도 그대로', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    store().dismissCelebration();
    store().recordRating();
    expect(store().celebration).toBeNull();
    expect(store().currentStreak).toBe(4);
  });

  it('홈 진입 시 이미 완료면 rating 에 축하 화면이 없다', () => {
    store().applyHomeStats({ currentStreak: 4, studiedToday: true, hasStudiedBefore: true });
    store().recordRating();
    expect(store().celebration).toBeNull();
    expect(store().currentStreak).toBe(4);
  });

  it('끊긴 상태(0일)에서 첫 rating 은 1일 + 다시 시작 문구', () => {
    store().applyHomeStats({ currentStreak: 0, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    expect(store().currentStreak).toBe(1);
    expect(store().celebration?.headline).toBe('불꽃을 다시 켰어요!');
  });

  it('한 번도 학습 안 한 유저의 첫 rating 은 1일 + 첫날 문구', () => {
    store().applyHomeStats({ currentStreak: 0, studiedToday: false, hasStudiedBefore: false });
    store().recordRating();
    expect(store().currentStreak).toBe(1);
    expect(store().celebration?.headline).toBe('첫 불꽃을 켰어요!');
  });

  it('홈 통계를 다시 받으면 서버 값이 이긴다 (다음 날 진입)', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    store().applyHomeStats({ currentStreak: 4, studiedToday: false, hasStudiedBefore: true });
    expect(store().studiedToday).toBe(false);
    store().recordRating();
    expect(store().currentStreak).toBe(5);
    expect(store().celebration?.streak).toBe(5);
  });

  it('showCelebration 은 학습 기록과 무관하게 화면만 띄운다 (디버그)', () => {
    const celebration = { ...streakCelebrationCopy(30, true), streak: 30, weekDots: WEEK };
    store().showCelebration(celebration);
    expect(store().celebration).toEqual(celebration);
    expect(store().currentStreak).toBe(0);
    expect(store().studiedToday).toBe(false);
  });
});
