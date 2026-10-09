import client from './client';
import { ArtistDetail } from '../types/artist';

export const artistApi = {
  async getDetail(artistId: number): Promise<ArtistDetail> {
    const { data } = await client.get<ArtistDetail>(`/api/artists/${artistId}`);
    return data;
  },
};
