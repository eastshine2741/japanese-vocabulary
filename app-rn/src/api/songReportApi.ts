import client from './client';
import {
  SongReportTypeDto,
  SubmitSongReportRequest,
  SubmitSongReportResponse,
} from '../types/songReport';

export const songReportApi = {
  async getTypes(): Promise<SongReportTypeDto[]> {
    const { data } = await client.get<SongReportTypeDto[]>('/api/song-reports/types');
    return data;
  },

  async submit(songId: number, request: SubmitSongReportRequest): Promise<SubmitSongReportResponse> {
    const { data } = await client.post<SubmitSongReportResponse>(`/api/songs/${songId}/reports`, request);
    return data;
  },
};
