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
  return config;
});

export default client;
