import client from './client';
import {
  applyHeatmapOverride,
  applyHomeOverride,
  applyProfileOverride,
  getStreakDebugState,
} from './debug/streakDebugOverride';
import { HeatmapResponse, HomeStats, ProfileStats } from '../types/studyStats';

async function fetchHome(): Promise<HomeStats> {
  const { data } = await client.get<HomeStats>('/api/study-stats/home');
  return data;
}

export const studyStatsApi = {
  async getHome(): Promise<HomeStats> {
    return applyHomeOverride(await fetchHome());
  },

  async getProfile(): Promise<ProfileStats> {
    const { data } = await client.get<ProfileStats>('/api/study-stats/profile');
    if (getStreakDebugState() === 'off') return data;
    // 연속 일수를 맞추려면 서버 기준 오늘 완료 여부가 필요하다 — 디버그 상황에서만 한 번 더 받는다.
    const home = await fetchHome();
    return applyProfileOverride(data, home.studiedToday);
  },

  async getHeatmap(): Promise<HeatmapResponse> {
    const { data } = await client.get<HeatmapResponse>('/api/study-stats/heatmap');
    return applyHeatmapOverride(data);
  },
};
