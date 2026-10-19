import client from './client';
import { DeckListResponse } from '../types/deck';
import { FlashcardStatsResponse } from '../types/flashcard';
import { RewardCardsResponse } from '../types/rewardCard';
import { HeatmapResponse } from '../types/studyStats';

/** 남에게 보이는 프로필. 이메일은 없다. */
export interface PublicUserProfile {
  userId: number;
  username: string;
  name: string;
  profileImageUrl: string | null;
  /** 내 프로필이다. 편집할 수 있는 내 프로필을 띄운다. */
  me: boolean;
}

/** 다른 유저의 프로필 화면. 모두 읽기 전용이고 내 프로필 API 와 같은 모양이다. */
export const userProfileApi = {
  async getProfile(userId: number): Promise<PublicUserProfile> {
    const { data } = await client.get<PublicUserProfile>(`/api/users/${userId}`);
    return data;
  },

  /** 서명까지 마친 카드만 온다. */
  async getRewardCards(userId: number): Promise<RewardCardsResponse> {
    const { data } = await client.get<RewardCardsResponse>(`/api/users/${userId}/reward-cards`);
    return data;
  },

  async getFlashcardStats(userId: number): Promise<FlashcardStatsResponse> {
    const { data } = await client.get<FlashcardStatsResponse>(`/api/users/${userId}/flashcard-stats`);
    return data;
  },

  async getDecks(userId: number): Promise<DeckListResponse> {
    const { data } = await client.get<DeckListResponse>(`/api/users/${userId}/decks`);
    return data;
  },

  async getHeatmap(userId: number): Promise<HeatmapResponse> {
    const { data } = await client.get<HeatmapResponse>(`/api/users/${userId}/study-stats/heatmap`);
    return data;
  },
};
