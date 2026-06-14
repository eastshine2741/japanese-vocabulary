import client from './client';

export const searchHistoryApi = {
  async getHistory(): Promise<string[]> {
    const { data } = await client.get<string[]>('/api/search-history');
    return data;
  },
  async deleteHistory(term: string): Promise<void> {
    await client.delete('/api/search-history', { params: { term } });
  },
};
