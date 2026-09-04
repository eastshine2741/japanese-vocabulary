import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';
import { isDevBuild } from '../utils/buildEnv';

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const client = axios.create({
  baseURL: DEFAULT_BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
});

export function getBaseURL(): string {
  return client.defaults.baseURL ?? DEFAULT_BACKEND_URL ?? '';
}

export async function initBaseURL(): Promise<void> {
  // The stored override is a dev-only affordance. Release builds stay pinned to
  // EXPO_PUBLIC_BACKEND_URL: iOS keeps SecureStore (Keychain) entries across app
  // uninstalls, so a dev URL left behind by an earlier install would otherwise
  // redirect the released app to an unreachable host — and the dialog that could
  // undo it is compiled out of release builds.
  if (!isDevBuild) return;
  const stored = await tokenStorage.getBaseURL();
  if (stored) {
    client.defaults.baseURL = stored;
  }
}

export async function setBaseURL(url: string) {
  client.defaults.baseURL = url;
  await tokenStorage.saveBaseURL(url);
}

client.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (__DEV__) {
    console.log(`[API REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data ?? '');
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API RES] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      if (error.response) {
        console.error(`[API ERR] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response.status}`, error.response.data);
      } else if (error.request) {
        console.error(`[API ERR] ${error.config?.method?.toUpperCase()} ${error.config?.url} → No response received. ${error.message}`, `code=${error.code}`);
      } else {
        console.error(`[API ERR] Request setup failed: ${error.message}`);
      }
    }
    return Promise.reject(error);
  },
);

export default client;
