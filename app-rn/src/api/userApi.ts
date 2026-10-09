import client from './client';

export interface UserProfile {
  username: string;
  name: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export type ProfileImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ProfileImageUploadUrl {
  key: string;
  uploadUrl: string;
  /** Part of the signature — the PUT must send them verbatim. */
  headers: Record<string, string>;
  expiresAt: string;
}

export interface UpdateProfilePayload {
  name?: string | null;
  username?: string;
}

export const userApi = {
  async getProfile(): Promise<UserProfile> {
    const { data } = await client.get<UserProfile>('/api/users/me');
    return data;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const { data } = await client.patch<UserProfile>('/api/users/me', payload);
    return data;
  },

  async issueProfileImageUploadUrl(contentType: ProfileImageContentType): Promise<ProfileImageUploadUrl> {
    const { data } = await client.post<ProfileImageUploadUrl>('/api/users/me/profile-image/upload-url', { contentType });
    return data;
  },

  async confirmProfileImage(key: string): Promise<UserProfile> {
    const { data } = await client.put<UserProfile>('/api/users/me/profile-image', { key });
    return data;
  },

  async removeProfileImage(): Promise<UserProfile> {
    const { data } = await client.delete<UserProfile>('/api/users/me/profile-image');
    return data;
  },

  async deleteSelf(): Promise<void> {
    await client.delete('/api/users/me');
  },
};
