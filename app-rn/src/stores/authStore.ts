import { create } from 'zustand';
import { AuthProvider, authApi, VerifiedIdentity } from '../api/authApi';
import { apiErrorMessage } from '../api/errors';
import { userApi } from '../api/userApi';
import { tokenStorage } from '../utils/tokenStorage';
import { getJwtUserId } from '../utils/jwt';
import { setAnalyticsUserId } from '../services/analytics';
import { requestPermissionAndRegisterToken } from '../services/pushNotifications';

type AuthStatus = 'idle' | 'loading' | 'success' | 'needs_signup' | 'error';

interface AuthState {
  status: AuthStatus;
  error: string | null;
  username: string | null;
  userName: string | null;
  email: string | null;
  pendingIdentity: VerifiedIdentity | null;
  pendingIdToken: string | null;
  pendingProvider: AuthProvider | null;
  googleLogin: (idToken: string) => Promise<void>;
  appleLogin: (idToken: string, displayName?: string) => Promise<void>;
  googleSignup: (idToken: string, username: string, displayName?: string) => Promise<void>;
  appleSignup: (idToken: string, username: string, displayName?: string) => Promise<void>;
  setError: (message: string | null) => void;
  loadProfile: () => Promise<void>;
  setUserName: (name: string | null) => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  reset: () => void;
}

async function persistProfile(username: string, name: string | null) {
  await tokenStorage.saveUsername(username);
  await tokenStorage.saveUserName(name);
}

// 로그인/가입 공통 경로. 토큰 저장과 분석 유저 식별을 한 곳에서 묶는다.
async function persistSession(token: string, username: string, name: string | null) {
  await tokenStorage.saveToken(token);
  await persistProfile(username, name);
  setAnalyticsUserId(getJwtUserId(token));
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  error: null,
  username: null,
  userName: null,
  email: null,
  pendingIdentity: null,
  pendingIdToken: null,
  pendingProvider: null,

  googleLogin: async (idToken) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleLogin(idToken);
      if (res.kind === 'needsSignup') {
        set({
          status: 'needs_signup',
          pendingIdentity: res.identity,
          pendingIdToken: idToken,
          pendingProvider: 'google',
        });
        return;
      }
      await persistSession(res.token, res.username, res.name);
      set({
        status: 'success',
        username: res.username,
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
        pendingProvider: null,
      });
      requestPermissionAndRegisterToken();
    } catch (e: any) {
      set({ status: 'error', error: apiErrorMessage(e, 'Google sign-in failed') });
    }
  },

  appleLogin: async (idToken, displayName) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.appleLogin(idToken);
      if (res.kind === 'needsSignup') {
        set({
          status: 'needs_signup',
          pendingIdentity: {
            ...res.identity,
            name: res.identity.name ?? displayName ?? null,
          },
          pendingIdToken: idToken,
          pendingProvider: 'apple',
        });
        return;
      }
      await persistSession(res.token, res.username, res.name);
      set({
        status: 'success',
        username: res.username,
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
        pendingProvider: null,
      });
      requestPermissionAndRegisterToken();
    } catch (e: any) {
      set({ status: 'error', error: apiErrorMessage(e, 'Apple sign-in failed') });
    }
  },

  googleSignup: async (idToken, username, displayName) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.googleSignup(idToken, username, displayName);
      await persistSession(res.token, res.username, res.name);
      set({
        status: 'success',
        username: res.username,
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
        pendingProvider: null,
      });
      requestPermissionAndRegisterToken();
    } catch (e: any) {
      set({ status: 'error', error: apiErrorMessage(e, 'Sign-up failed') });
    }
  },

  appleSignup: async (idToken, username, displayName) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.appleSignup(idToken, username, displayName);
      await persistSession(res.token, res.username, res.name);
      set({
        status: 'success',
        username: res.username,
        userName: res.name,
        pendingIdentity: null,
        pendingIdToken: null,
        pendingProvider: null,
      });
      requestPermissionAndRegisterToken();
    } catch (e: any) {
      set({ status: 'error', error: apiErrorMessage(e, 'Sign-up failed') });
    }
  },

  // Sign-in can fail natively, before any store action runs (no Apple account on the
  // device, Play Services missing). Those failures need the same error slot as the
  // API ones, or the button just looks dead.
  setError: (message) => set({ status: message ? 'error' : 'idle', error: message }),

  // Cached values show immediately; the server copy then wins so edits made
  // elsewhere (or a cache wiped by reinstall) don't leave stale identity on screen.
  loadProfile: async () => {
    const [username, name, email] = await Promise.all([
      tokenStorage.getUsername(),
      tokenStorage.getUserName(),
      tokenStorage.getEmail(),
    ]);
    set({ username, userName: name, email });
    try {
      const profile = await userApi.getProfile();
      await Promise.all([
        persistProfile(profile.username, profile.name),
        tokenStorage.saveEmail(profile.email),
      ]);
      set({ username: profile.username, userName: profile.name, email: profile.email });
    } catch {
      // keep the cached copy; auth failures are handled by the API client
    }
  },

  setUserName: async (name) => {
    await tokenStorage.saveUserName(name);
    set({ userName: name });
  },

  setUsername: async (username) => {
    await tokenStorage.saveUsername(username);
    set({ username });
  },

  reset: () =>
    set({
      status: 'idle',
      error: null,
      pendingIdentity: null,
      pendingIdToken: null,
      pendingProvider: null,
    }),
}));
