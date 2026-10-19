import client from './client';
import {
  RewardCardRevealDto,
  RewardCardShareDto,
  RewardCardShareKind,
  RewardCardsResponse,
  ShareImageUploadUrl,
  SharedRewardCardDto,
} from '../types/rewardCard';

export const rewardCardApi = {
  async getCards(): Promise<RewardCardsResponse> {
    const { data } = await client.get<RewardCardsResponse>('/api/reward-cards');
    return data;
  },

  /** 서명 전에 앱을 끈 카드와 못 본 아티스트 카드 강화. */
  async getPending(): Promise<RewardCardRevealDto[]> {
    const { data } = await client.get<{ reveals: RewardCardRevealDto[] }>('/api/reward-cards/pending');
    return data.reveals;
  },

  async issueSongCard(cardId: number, signature: string[], lyricLineIndexes: number[]): Promise<void> {
    await client.post(`/api/reward-cards/song-cards/${cardId}/issue`, { signature, lyricLineIndexes });
  },

  async issueArtistCard(cardId: number, signature: string[]): Promise<void> {
    await client.post(`/api/reward-cards/artist-cards/${cardId}/issue`, { signature });
  },

  /** 강화 연출을 이 등급까지 봤다. */
  async markArtistCardSeen(cardId: number, grade: string): Promise<void> {
    await client.post(`/api/reward-cards/artist-cards/${cardId}/seen`, { grade });
  },

  async updateSongCardLyric(cardId: number, lyricLineIndexes: number[]): Promise<void> {
    await client.put(`/api/reward-cards/song-cards/${cardId}/lyric`, { lyricLineIndexes });
  },

  /** 같은 카드는 늘 같은 링크다. imageUploaded 면 막 올린 미리보기를 서버가 확인한다. */
  async shareCard(kind: RewardCardShareKind, id: number, imageUploaded = false): Promise<RewardCardShareDto> {
    const { data } = await client.put<RewardCardShareDto>(`/api/reward-cards/${kind}/${id}/share`, { imageUploaded });
    return data;
  },

  async issueShareImageUploadUrl(kind: RewardCardShareKind, id: number): Promise<ShareImageUploadUrl> {
    const { data } = await client.post<ShareImageUploadUrl>(`/api/reward-cards/${kind}/${id}/share/image-upload-url`);
    return data;
  },

  async getSharedCard(token: string): Promise<SharedRewardCardDto> {
    const { data } = await client.get<SharedRewardCardDto>(`/api/reward-card-shares/${encodeURIComponent(token)}`);
    return data;
  },
};
