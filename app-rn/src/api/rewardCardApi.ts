import client from './client';
import { RewardCardRevealDto, RewardCardsResponse } from '../types/rewardCard';

export const rewardCardApi = {
  async getCards(): Promise<RewardCardsResponse> {
    const { data } = await client.get<RewardCardsResponse>('/api/reward-cards');
    return data;
  },

  /** 서명 전에 앱을 끈 카드와 못 본 등급 오름. */
  async getPending(): Promise<RewardCardRevealDto[]> {
    const { data } = await client.get<{ reveals: RewardCardRevealDto[] }>('/api/reward-cards/pending');
    return data.reveals;
  },

  async issueSongCard(songId: number, signature: string[], lyricLineIndexes: number[]): Promise<void> {
    await client.post(`/api/reward-cards/songs/${songId}/issue`, { signature, lyricLineIndexes });
  },

  async issueArtistCard(artistId: number, signature: string[]): Promise<void> {
    await client.post(`/api/reward-cards/artists/${artistId}/issue`, { signature });
  },

  async markSongCardSeen(songId: number, grade: string): Promise<void> {
    await client.post(`/api/reward-cards/songs/${songId}/seen`, { grade });
  },

  async markArtistCardSeen(artistId: number, grade: string): Promise<void> {
    await client.post(`/api/reward-cards/artists/${artistId}/seen`, { grade });
  },

  async updateSongCardLyric(songId: number, lyricLineIndexes: number[]): Promise<void> {
    await client.put(`/api/reward-cards/songs/${songId}/lyric`, { lyricLineIndexes });
  },
};
