import client from './client';
import { HeatmapResponse, HomeStats, ProfileStats } from '../types/studyStats';

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
};
