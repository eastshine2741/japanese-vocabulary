import client from './client';
import {
  SongSearchResponse,
  SongStudyData,
  RecentSongItem,
  AnalyzeSongRequest,
} from '../types/song';

export const songApi = {
  async search(query: string): Promise<SongSearchResponse> {
    const { data } = await client.get<SongSearchResponse>('/api/songs/search', {
      params: { q: query },
    });
    return data;
  },

  async analyze(req: AnalyzeSongRequest): Promise<SongStudyData> {
    const { data } = await client.post<SongStudyData>('/api/songs/analyze', req);
    return data;
  },

  async getRecent(): Promise<RecentSongItem[]> {
    const { data } = await client.get<RecentSongItem[]>('/api/songs/recent');
    return data;
  },

  async getById(id: number): Promise<SongStudyData> {
    const { data } = await client.get<SongStudyData>(`/api/songs/${id}`);
    return data;
  },
};
