import { create } from 'zustand';
import { authApi, VerifiedIdentity } from '../api/authApi';
import { tokenStorage } from '../utils/tokenStorage';

type AuthStatus = 'idle' | 'loading' | 'success' | 'needs_signup' | 'error';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  username: string | null;
  userName: string | null;
  pendingIdentity: VerifiedIdentity | null;
  pendingIdToken: string | null;
  googleLogin: (idToken: string) => Promise<void>;
  googleSignup: (idToken: string, username: string, displayName?: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  reset: () => void;
}

async function persistProfile(username: string, name: string | null) {
  await tokenStorage.saveUsername(username);
  await tokenStorage.saveUserName(name);
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  error: null,
  username: null,
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
      await persistProfile(res.username, res.name);
      set({ status: 'success', username: res.username, userName: res.name });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Google sign-in failed' });
    }
  },

  googleSignup: async (idToken, username, displayName) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleSignup(idToken, username, displayName);
      await tokenStorage.saveToken(res.token);
      await persistProfile(res.username, res.name);
      set({
        status: 'success',
        username: res.username,
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
      });
    } catch (e: any) {
      set({ status: 'error', error: e.response?.data?.message || 'Sign-up failed' });
    }
  },

  loadProfile: async () => {
    const [username, name] = await Promise.all([
      tokenStorage.getUsername(),
      tokenStorage.getUserName(),
    ]);
    set({ username, userName: name });
  },

  reset: () => set({ status: 'idle', error: null, pendingIdentity: null, pendingIdToken: null }),
}));
