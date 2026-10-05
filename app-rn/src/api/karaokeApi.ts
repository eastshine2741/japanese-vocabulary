import client from './client';
import { KaraokeDailyGroup, KaraokeMonthly } from '../types/karaoke';

export const karaokeApi = {
  /** month 는 YYYY-MM. 날짜 최신순 그룹. */
  async getDaily(month: string): Promise<KaraokeDailyGroup[]> {
    const { data } = await client.get<KaraokeDailyGroup[]>('/api/karaoke-songs/daily', {
      params: { month },
    });
    return data;
  },

  async getMonthly(month: string): Promise<KaraokeMonthly> {
    const { data } = await client.get<KaraokeMonthly>('/api/karaoke-songs/monthly', {
      params: { month },
    });
    return data;
  },
};
