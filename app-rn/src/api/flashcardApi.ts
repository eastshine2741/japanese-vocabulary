import client from './client';
import {
  DueFlashcardsResponse,
  ReviewRequest,
  ReviewResponse,
  FlashcardStatsResponse,
  UserSettingsDTO,
} from '../types/flashcard';

export const flashcardApi = {
  async getDueCards(songId?: number): Promise<DueFlashcardsResponse> {
    const { data } = await client.get<DueFlashcardsResponse>('/api/flashcards/due', {
      params: songId != null ? { songId } : {},
    });
    return data;
  },

  async review(id: number, req: ReviewRequest): Promise<ReviewResponse> {
    const { data } = await client.post<ReviewResponse>(`/api/flashcards/${id}/review`, req);
    return data;
  },

  async getStats(): Promise<FlashcardStatsResponse> {
    const { data } = await client.get<FlashcardStatsResponse>('/api/flashcards/stats');
    return data;
  },

  async getSettings(): Promise<UserSettingsDTO> {
    const { data } = await client.get<UserSettingsDTO>('/api/settings');
    return data;
  },

  async updateSettings(settings: UserSettingsDTO): Promise<UserSettingsDTO> {
    const { data } = await client.put<UserSettingsDTO>('/api/settings', settings);
    return data;
  },

  async registerDeviceToken(req: { token: string; platform: 'IOS' | 'ANDROID' }): Promise<void> {
    await client.post('/api/users/me/device-tokens', req);
  },

  async unregisterDeviceToken(req: { token: string }): Promise<void> {
    await client.delete('/api/users/me/device-tokens', { data: req });
  },
};
