import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const client = axios.create({
  baseURL: DEFAULT_BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
});

export function getBaseURL(): string {
  return client.defaults.baseURL ?? DEFAULT_BACKEND_URL ?? '';
}

export function setBaseURL(url: string) {
  client.defaults.baseURL = url;
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
