import client from './client';

export interface GoogleAuthResponse {
  token: string;
  name: string;
}

export const authApi = {
  async googleLogin(idToken: string): Promise<GoogleAuthResponse> {
    const { data } = await client.post<GoogleAuthResponse>('/api/auth/google', { idToken });
    return data;
  },
};
