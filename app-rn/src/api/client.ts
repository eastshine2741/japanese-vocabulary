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
  console.log(`[API REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.data ? JSON.stringify(config.data) : '');
  return config;
});

client.interceptors.response.use(
  (response) => {
    console.log(`[API RES] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API ERR] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response.status}`, JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error(`[API ERR] ${error.config?.method?.toUpperCase()} ${error.config?.url} → No response received. ${error.message}`, `code=${error.code}`);
    } else {
      console.error(`[API ERR] Request setup failed: ${error.message}`);
    }
    return Promise.reject(error);
  },
);

export default client;
