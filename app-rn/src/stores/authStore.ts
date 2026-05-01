import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { tokenStorage } from '../utils/tokenStorage';

type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  userName: string | null;
  googleLogin: (idToken: string) => Promise<void>;
  loadUserName: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  error: null,
  userName: null,

  googleLogin: async (idToken) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleLogin(idToken);
      await tokenStorage.saveToken(res.token);
      await tokenStorage.saveUserName(res.name);
      set({ status: 'success', userName: res.name });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Google sign-in failed' });
    }
  },

  loadUserName: async () => {
    const name = await tokenStorage.getUserName();
    set({ userName: name });
  },

  reset: () => set({ status: 'idle', error: null }),
}));
