import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { tokenStorage } from '../utils/tokenStorage';

type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  userName: string | null;
  login: (name: string, password: string) => Promise<void>;
  signup: (name: string, password: string) => Promise<void>;
  loadUserName: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  error: null,
  userName: null,

  login: async (name, password) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.login({ name, password });
      await tokenStorage.saveToken(res.token);
      await tokenStorage.saveUserName(name);
      set({ status: 'success', userName: name });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Login failed' });
    }
  },

  signup: async (name, password) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.signup({ name, password });
      await tokenStorage.saveToken(res.token);
      await tokenStorage.saveUserName(name);
      set({ status: 'success', userName: name });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Signup failed' });
    }
  },

  loadUserName: async () => {
    const name = await tokenStorage.getUserName();
    set({ userName: name });
  },

  reset: () => set({ status: 'idle', error: null }),
}));
