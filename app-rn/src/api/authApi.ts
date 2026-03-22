import client from './client';
import { AuthRequest, AuthResponse } from '../types/auth';

export const authApi = {
  async signup(req: AuthRequest): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/api/auth/signup', req);
    return data;
  },

  async login(req: AuthRequest): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/api/auth/login', req);
    return data;
  },
};
