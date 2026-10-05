import client from './client';
import { HeatmapResponse, HomeStats, ProfileStats, StudyCalendarPage } from '../types/studyStats';

export const studyStatsApi = {
  async getHome(): Promise<HomeStats> {
    const { data } = await client.get<HomeStats>('/api/study-stats/home');
    return data;
  },

  async getProfile(): Promise<ProfileStats> {
    const { data } = await client.get<ProfileStats>('/api/study-stats/profile');
    return data;
  },

  async getHeatmap(): Promise<HeatmapResponse> {
    const { data } = await client.get<HeatmapResponse>('/api/study-stats/heatmap');
    return data;
  },

  /** before 없이 부르면 이번 달까지의 첫 페이지. */
  async getCalendar(before?: string): Promise<StudyCalendarPage> {
    const { data } = await client.get<StudyCalendarPage>('/api/study-stats/calendar', {
      params: before ? { before } : undefined,
    });
    return data;
  },
};
