import client from './client';
import {
  SongContributorsDto,
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

  /** 승인된 제보를 낸 사람들. 첫 승인 순. */
  async getContributors(songId: number): Promise<SongContributorsDto> {
    const { data } = await client.get<SongContributorsDto>(`/api/songs/${songId}/contributors`);
    return data;
  },
};
