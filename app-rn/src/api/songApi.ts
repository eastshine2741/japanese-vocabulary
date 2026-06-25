import client from './client';
import {
  SongSearchResponse,
  SongStudyData,
  RecentSongItem,
  RecommendedSongItem,
  AnalyzeSongRequest,
  SongAnalysisWorkResponse,
} from '../types/song';

export const songApi = {
  async search(query: string): Promise<SongSearchResponse> {
    const { data } = await client.get<SongSearchResponse>('/api/songs/search', {
      params: { q: query },
    });
    return data;
  },

  async analyze(req: AnalyzeSongRequest): Promise<SongAnalysisWorkResponse> {
    const { data } = await client.post<SongAnalysisWorkResponse>('/api/songs/analyze', req);
    return data;
  },

  async getAnalysisWork(workId: number): Promise<SongAnalysisWorkResponse> {
    const { data } = await client.get<SongAnalysisWorkResponse>(`/api/songs/analysis-work/${workId}`);
    return data;
  },

  async getByTitleArtist(title: string, artistName: string): Promise<SongStudyData | null> {
    const res = await client.get<SongStudyData>('/api/songs', {
      params: { title, artistName },
    });
    if (res.status === 204 || res.data == null || !(res.data as any).song) {
      return null;
    }
    return res.data;
  },

  async getRecent(): Promise<RecentSongItem[]> {
    const { data } = await client.get<RecentSongItem[]>('/api/songs/recent');
    return data;
  },

  async getRecommendations(): Promise<RecommendedSongItem[]> {
    const { data } = await client.get<RecommendedSongItem[]>('/api/songs/recommendations');
    return data;
  },

  async getById(id: number): Promise<SongStudyData> {
    const { data } = await client.get<SongStudyData>(`/api/songs/${id}`);
    return data;
  },

  async getSpotlight(): Promise<SongStudyData | null> {
    const res = await client.get<SongStudyData>('/api/songs/spotlight');
    // 204 No Content (or an empty body) means there is no song to spotlight.
    if (res.status === 204 || res.data == null || !(res.data as any).song) {
      return null;
    }
    return res.data;
  },
};
