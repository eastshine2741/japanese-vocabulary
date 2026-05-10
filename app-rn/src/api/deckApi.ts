import client from './client';
import { DeckListResponse, DeckDetailResponse, DeckWordListResponse } from '../types/deck';

export const deckApi = {
  async getDecks(cursor?: number): Promise<DeckListResponse> {
    const { data } = await client.get<DeckListResponse>('/api/decks', {
      params: cursor != null ? { cursor } : {},
    });
    return data;
  },

  async getAllDeckDetail(): Promise<DeckDetailResponse> {
    const { data } = await client.get<DeckDetailResponse>('/api/decks/all');
    return data;
  },

  async getDeckDetail(deckId: number): Promise<DeckDetailResponse> {
    const { data } = await client.get<DeckDetailResponse>(`/api/decks/${deckId}`);
    return data;
  },

  async getDeckBySongId(songId: number): Promise<DeckDetailResponse | null> {
    const res = await client.get<DeckDetailResponse>(`/api/decks/by-song/${songId}`);
    return res.status === 204 ? null : res.data;
  },

  async getAllDeckWords(cursor?: number): Promise<DeckWordListResponse> {
    const { data } = await client.get<DeckWordListResponse>('/api/decks/all/words', {
      params: cursor != null ? { cursor } : {},
    });
    return data;
  },

  async getDeckWords(deckId: number, cursor?: number): Promise<DeckWordListResponse> {
    const { data } = await client.get<DeckWordListResponse>(`/api/decks/${deckId}/words`, {
      params: cursor != null ? { cursor } : {},
    });
    return data;
  },
};
