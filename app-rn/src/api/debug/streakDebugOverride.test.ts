import { describe, expect, it } from 'vitest';
import { applyHeatmapOverride, applyHomeOverride, applyProfileOverride } from './streakDebugOverride';
import { streakMode } from '../../components/streak/streakCalendar';
import { HeatmapResponse, HomeStats, ProfileStats } from '../../types/studyStats';

const home: HomeStats = {
  currentStreak: 3,
  freezeCount: 1,
  freezeMax: 2,
  studiedToday: false,
  hasStudiedBefore: true,
  weekDots: [
    { date: '2026-10-02', status: 'studied' },
    { date: '2026-10-03', status: 'studied' },
    { date: '2026-10-04', status: 'today' },
  ],
};
const heatmap: HeatmapResponse = {
  days: [
    { date: '2026-10-02', reviewCount: 5, freezeUsed: false },
    { date: '2026-10-03', reviewCount: 8, freezeUsed: false },
    { date: '2026-10-04', reviewCount: 0, freezeUsed: false },
  ],
};
const profile: ProfileStats = {
  currentStreak: 3, longestStreak: 3, totalStudyDays: 10, freezeCount: 1, freezeMax: 2, dailyGoal: 20,
};

function dayOf(res: HeatmapResponse, date: string) {
  return res.days.find((d) => d.date === date);
}

function modeOf(s: 'pending' | 'done' | 'frozen', base = home, baseHeatmap = heatmap) {
  return streakMode(applyHomeOverride(base, s).studiedToday, applyHeatmapOverride(baseHeatmap, s).days);
}

describe('streakDebugOverride', () => {
  it('off 면 서버 값을 그대로 둔다', () => {
    expect(applyHomeOverride(home, 'off')).toBe(home);
    expect(applyHeatmapOverride(heatmap, 'off')).toBe(heatmap);
    expect(applyProfileOverride(profile, false, 'off')).toBe(profile);
  });

  it('고른 상황이 연속 학습 화면의 모드와 맞는다', () => {
    expect(modeOf('pending')).toBe('pending');
    expect(modeOf('done')).toBe('done');
    expect(modeOf('frozen')).toBe('frozen');
  });

  it('완료로 바꾸면 오늘 칸에 복습이 생기고 연속 일수가 하루 는다', () => {
    expect(applyHomeOverride(home, 'done').currentStreak).toBe(4);
    expect(dayOf(applyHeatmapOverride(heatmap, 'done'), '2026-10-04')!.reviewCount).toBeGreaterThan(0);
    expect(applyProfileOverride(profile, false, 'done')).toMatchObject({ currentStreak: 4, longestStreak: 4 });
  });

  it('이미 완료한 날을 아직으로 바꾸면 하루 빼고 오늘 복습을 비운다', () => {
    const studied = { ...home, studiedToday: true, currentStreak: 4 };
    const studiedHeatmap = { days: heatmap.days.map((d, i) => (i === 2 ? { ...d, reviewCount: 12 } : d)) };
    expect(applyHomeOverride(studied, 'pending')).toMatchObject({ studiedToday: false, currentStreak: 3 });
    expect(dayOf(applyHeatmapOverride(studiedHeatmap, 'pending'), '2026-10-04')!.reviewCount).toBe(0);
    expect(modeOf('pending', studied, studiedHeatmap)).toBe('pending');
  });

  it('프리즈로 바꾸면 어제 칸이 프리즈가 된다', () => {
    expect(applyHomeOverride(home, 'frozen').weekDots[1].status).toBe('freeze');
    expect(dayOf(applyHeatmapOverride(heatmap, 'frozen'), '2026-10-03')).toMatchObject({ reviewCount: 0, freezeUsed: true });
  });

  it('프리즈 상황은 10/1·10/2 학습, 10/3 프리즈, 10/4 아직으로 고정된다', () => {
    const days = ['09-30', '10-01', '10-02', '10-03', '10-04'].map((d) => ({
      date: `2026-${d}`, reviewCount: 7, freezeUsed: false,
    }));
    expect(applyHeatmapOverride({ days }, 'frozen').days.slice(-5)).toMatchObject([
      { date: '2026-09-30', reviewCount: 0, freezeUsed: false },
      { date: '2026-10-01', freezeUsed: false },
      { date: '2026-10-02', freezeUsed: false },
      { date: '2026-10-03', reviewCount: 0, freezeUsed: true },
      { date: '2026-10-04', reviewCount: 0 },
    ]);
    expect(applyHomeOverride(home, 'frozen').currentStreak).toBe(2);
    expect(applyProfileOverride(profile, false, 'frozen').currentStreak).toBe(2);
  });

  it('오늘 기준 26~22일 전(9/8~9/12)에 학습 기록을 넣는다', () => {
    const res = applyHeatmapOverride(heatmap, 'pending');
    for (const date of ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']) {
      expect(dayOf(res, date)!.reviewCount).toBeGreaterThan(0);
    }
    expect(dayOf(res, '2026-09-07')).toBeUndefined();
    expect(res.days.map((d) => d.date)).toEqual([...res.days.map((d) => d.date)].sort());
  });
});
