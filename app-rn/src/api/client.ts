import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const client = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.message}`, error.response?.status, error.response?.data);
    return Promise.reject(error);
  },
);

export default client;
