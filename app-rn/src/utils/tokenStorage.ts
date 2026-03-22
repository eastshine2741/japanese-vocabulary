import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jwt_token';

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
      },
    };
