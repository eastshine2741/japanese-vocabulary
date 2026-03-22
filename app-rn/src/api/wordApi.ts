import client from './client';
import { WordDefinitionDTO, WordDetailResponse, WordListResponse, AddWordRequest } from '../types/word';

export const wordApi = {
  async lookup(word: string): Promise<WordDefinitionDTO> {
    const { data } = await client.get<WordDefinitionDTO>('/api/words/lookup', {
      params: { word },
    });
    return data;
  },

  async addWord(req: AddWordRequest): Promise<{ id: number }> {
    const { data } = await client.post<{ id: number }>('/api/words', req);
    return data;
  },

  async getWords(cursor?: number): Promise<WordListResponse> {
    const { data } = await client.get<WordListResponse>('/api/words', {
      params: cursor ? { cursor } : {},
    });
    return data;
  },

  async getByText(japanese: string): Promise<WordDetailResponse | null> {
    try {
      const { data } = await client.get<WordDetailResponse>('/api/words/by-text', {
        params: { japanese },
      });
      return data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  },
};
