import client from './client';
import { DeckListResponse, DeckDetailResponse, DeckWordListResponse } from '../types/deck';

export const deckApi = {
  async getDecks(): Promise<DeckListResponse> {
    const { data } = await client.get<DeckListResponse>('/api/decks');
    return data;
  },

  async getDeckDetail(songId: number | null): Promise<DeckDetailResponse> {
    const path = songId != null ? `/api/decks/${songId}` : '/api/decks/all';
    const { data } = await client.get<DeckDetailResponse>(path);
    return data;
  },

  async getDeckWords(songId: number | null, cursor?: number): Promise<DeckWordListResponse> {
    const path = songId != null ? `/api/decks/${songId}/words` : '/api/decks/all/words';
    const { data } = await client.get<DeckWordListResponse>(path, {
      params: cursor ? { cursor } : {},
    });
    return data;
  },
};
