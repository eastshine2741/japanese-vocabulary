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
    expect(applyHeatmapOverride(heatmap, 'done').days[2].reviewCount).toBeGreaterThan(0);
    expect(applyProfileOverride(profile, false, 'done')).toMatchObject({ currentStreak: 4, longestStreak: 4 });
  });

  it('이미 완료한 날을 아직으로 바꾸면 하루 빼고 오늘 복습을 비운다', () => {
    const studied = { ...home, studiedToday: true, currentStreak: 4 };
    const studiedHeatmap = { days: heatmap.days.map((d, i) => (i === 2 ? { ...d, reviewCount: 12 } : d)) };
    expect(applyHomeOverride(studied, 'pending')).toMatchObject({ studiedToday: false, currentStreak: 3 });
    expect(applyHeatmapOverride(studiedHeatmap, 'pending').days[2].reviewCount).toBe(0);
    expect(modeOf('pending', studied, studiedHeatmap)).toBe('pending');
  });

  it('프리즈로 바꾸면 어제 칸이 프리즈가 된다', () => {
    expect(applyHomeOverride(home, 'frozen').weekDots[1].status).toBe('freeze');
    expect(applyHeatmapOverride(heatmap, 'frozen').days[1]).toMatchObject({ reviewCount: 0, freezeUsed: true });
  });
});
