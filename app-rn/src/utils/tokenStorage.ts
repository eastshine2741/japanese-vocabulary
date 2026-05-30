import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jwt_token';
const BASE_URL_KEY = 'base_url';
const USER_NAME_KEY = 'user_name';
const USERNAME_KEY = 'username';

export const tokenStorage = Platform.OS === 'web'
  ? {
      async getToken(): Promise<string | null> {
        return localStorage.getItem(TOKEN_KEY);
      },
      async saveToken(token: string): Promise<void> {
        localStorage.setItem(TOKEN_KEY, token);
      },
      async clearToken(): Promise<void> {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_NAME_KEY);
        localStorage.removeItem(USERNAME_KEY);
      },
      async getBaseURL(): Promise<string | null> {
        return localStorage.getItem(BASE_URL_KEY);
      },
      async saveBaseURL(url: string): Promise<void> {
        localStorage.setItem(BASE_URL_KEY, url);
      },
      async clearBaseURL(): Promise<void> {
        localStorage.removeItem(BASE_URL_KEY);
      },
      async getUserName(): Promise<string | null> {
        return localStorage.getItem(USER_NAME_KEY);
      },
      async saveUserName(name: string | null): Promise<void> {
        if (name == null) localStorage.removeItem(USER_NAME_KEY);
        else localStorage.setItem(USER_NAME_KEY, name);
      },
      async getUsername(): Promise<string | null> {
        return localStorage.getItem(USERNAME_KEY);
      },
      async saveUsername(username: string): Promise<void> {
        localStorage.setItem(USERNAME_KEY, username);
      },
    }
  : {
      async getToken(): Promise<string | null> {
        return SecureStore.getItemAsync(TOKEN_KEY);
      },
      async saveToken(token: string): Promise<void> {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      },
      async clearToken(): Promise<void> {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_NAME_KEY);
        await SecureStore.deleteItemAsync(USERNAME_KEY);
      },
      async getBaseURL(): Promise<string | null> {
        return SecureStore.getItemAsync(BASE_URL_KEY);
      },
      async saveBaseURL(url: string): Promise<void> {
        await SecureStore.setItemAsync(BASE_URL_KEY, url);
      },
      async clearBaseURL(): Promise<void> {
        await SecureStore.deleteItemAsync(BASE_URL_KEY);
      },
      async getUserName(): Promise<string | null> {
        return SecureStore.getItemAsync(USER_NAME_KEY);
      },
      async saveUserName(name: string | null): Promise<void> {
        if (name == null) await SecureStore.deleteItemAsync(USER_NAME_KEY);
        else await SecureStore.setItemAsync(USER_NAME_KEY, name);
      },
      async getUsername(): Promise<string | null> {
        return SecureStore.getItemAsync(USERNAME_KEY);
      },
      async saveUsername(username: string): Promise<void> {
        await SecureStore.setItemAsync(USERNAME_KEY, username);
      },
    };
