import client from './client';
import {
  CreateDeckRequest,
  DeckDeletionPreviewResponse,
  DeckDetailResponse,
  DeckListResponse,
  DeckResponse,
  DeckWordListResponse,
} from '../types/deck';

export const deckApi = {
  /** 곡에 매핑되지 않은 일반 단어장을 만든다. */
  async createDeck(req: CreateDeckRequest): Promise<DeckResponse> {
    const { data } = await client.post<DeckResponse>('/api/decks', req);
    return data;
  },

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

  async getDeletionPreview(deckId: number): Promise<DeckDeletionPreviewResponse> {
    const { data } = await client.get<DeckDeletionPreviewResponse>(`/api/decks/${deckId}/deletion-preview`);
    return data;
  },

  /** 이 덱에만 있던 단어는 복습 기록과 함께 지워지고, 다른 덱에도 담긴 단어는 남는다. */
  async deleteDeck(deckId: number): Promise<void> {
    await client.delete(`/api/decks/${deckId}`);
  },
};
