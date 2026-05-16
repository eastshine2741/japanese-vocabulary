import { create } from 'zustand';
import { authApi, VerifiedIdentity } from '../api/authApi';
import { tokenStorage } from '../utils/tokenStorage';

type AuthStatus = 'idle' | 'loading' | 'success' | 'needs_signup' | 'error';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  userName: string | null;
  pendingIdentity: VerifiedIdentity | null;
  pendingIdToken: string | null;
  googleLogin: (idToken: string) => Promise<void>;
  googleSignup: (idToken: string, username: string, displayName?: string) => Promise<void>;
  loadUserName: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  error: null,
  userName: null,
  pendingIdentity: null,
  pendingIdToken: null,

  googleLogin: async (idToken) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleLogin(idToken);
      if (res.kind === 'needsSignup') {
        set({ status: 'needs_signup', pendingIdentity: res.identity, pendingIdToken: idToken });
        return;
      }
      await tokenStorage.saveToken(res.token);
      await tokenStorage.saveUserName(res.name);
      set({ status: 'success', userName: res.name });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Google sign-in failed' });
    }
  },

  googleSignup: async (idToken, username, displayName) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleSignup(idToken, username, displayName);
      await tokenStorage.saveToken(res.token);
      await tokenStorage.saveUserName(res.name);
      set({
        status: 'success',
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
      });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Sign-up failed' });
    }
  },

  loadUserName: async () => {
    const name = await tokenStorage.getUserName();
    set({ userName: name });
  },

  reset: () => set({ status: 'idle', error: null, pendingIdentity: null, pendingIdToken: null }),
}));
