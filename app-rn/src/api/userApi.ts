import client from './client';

export interface UserProfile {
  username: string;
  name: string | null;
}

export const userApi = {
  async updateName(name: string | null): Promise<UserProfile> {
    const { data } = await client.patch<UserProfile>('/api/users/me', { name });
    return data;
  },
};
