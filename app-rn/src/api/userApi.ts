import client from './client';

export interface UserProfile {
  username: string;
  name: string | null;
}

export interface UpdateProfilePayload {
  name?: string | null;
  username?: string;
}

export const userApi = {
  async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const { data } = await client.patch<UserProfile>('/api/users/me', payload);
    return data;
  },

  async deleteSelf(): Promise<void> {
    await client.delete('/api/users/me');
  },
};
