import client from './client';
import { WordDetailResponse, WordListResponse, AddWordRequest, BatchAddWordRequest, BatchAddWordResponse, UpdateWordRequest } from '../types/word';

export const wordApi = {
  async addWord(req: AddWordRequest): Promise<{ id: number }> {
    const { data } = await client.post<{ id: number }>('/api/words', req);
    return data;
  },

  async batchAddWords(req: BatchAddWordRequest): Promise<BatchAddWordResponse> {
    const { data } = await client.post<BatchAddWordResponse>('/api/words/batch', req);
    return data;
  },

  async getWords(cursor?: number): Promise<WordListResponse> {
    const { data } = await client.get<WordListResponse>('/api/words', {
      params: cursor ? { cursor } : {},
    });
    return data;
  },

  async updateWord(id: number, req: UpdateWordRequest): Promise<WordDetailResponse> {
    const { data } = await client.put<WordDetailResponse>(`/api/words/${id}`, req);
    return data;
  },

  async deleteWord(id: number): Promise<void> {
    await client.delete(`/api/words/${id}`);
  },

  async getByText(japanese: string): Promise<WordDetailResponse | null> {
    const resp = await client.get<WordDetailResponse>('/api/words/by-text', {
      params: { japanese },
    });
    return resp.status === 204 ? null : resp.data;
  },
};
