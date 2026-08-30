import client from './client';

export type AuthProvider = 'google' | 'apple';

export interface AuthResponse {
  token: string;
  username: string;
  name: string | null;
}

export interface VerifiedIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

export type AuthProvider = 'google' | 'apple';

export type ProviderLoginResult =
  | { kind: 'authenticated'; token: string; username: string; name: string | null }
  | { kind: 'needsSignup'; identity: VerifiedIdentity };

export type UsernameAvailabilityReason = 'INVALID_FORMAT' | 'RESERVED' | 'TAKEN';

export interface UsernameAvailability {
  available: boolean;
  reason?: UsernameAvailabilityReason;
}

interface LoginResponseBody {
  kind: 'authenticated' | 'needsSignup';
  token?: string;
  username?: string;
  name?: string | null;
  identity?: VerifiedIdentity;
}

function toLoginResult(data: LoginResponseBody): LoginResult {
  if (data.kind === 'needsSignup') {
    return { kind: 'needsSignup', identity: data.identity! };
  }
  return {
    kind: 'authenticated',
    token: data.token!,
    username: data.username!,
    name: data.name ?? null,
  };
}

export const authApi = {
  async googleLogin(idToken: string): Promise<ProviderLoginResult> {
    const { data } = await client.post<GoogleLoginResponseBody>('/api/auth/google', { idToken });
    if (data.kind === 'needsSignup') {
      return { kind: 'needsSignup', identity: data.identity! };
    }
    return {
      kind: 'authenticated',
      token: data.token!,
      username: data.username!,
      name: data.name ?? null,
    };
  },

  async googleSignup(
    idToken: string,
    username: string,
    displayName?: string,
  ): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/api/auth/google/signup', {
      idToken,
      username,
      displayName,
    });
    return data;
  },

  async appleLogin(idToken: string): Promise<LoginResult> {
    const { data } = await client.post<LoginResponseBody>('/api/auth/apple', { idToken });
    return toLoginResult(data);
  },

  async appleSignup(
    idToken: string,
    username: string,
    displayName?: string,
  ): Promise<AuthResponse> {
    const { data } = await client.post<AuthResponse>('/api/auth/apple/signup', {
      idToken,
      username,
      displayName,
    });
    return data;
  },

  async appleLogin(idToken: string): Promise<ProviderLoginResult> {
    const { data } = await client.post<GoogleLoginResponseBody>('/api/auth/apple', { idToken });
    if (data.kind === 'needsSignup') {
      return { kind: 'needsSignup', identity: data.identity! };
    }
    return {
      kind: 'authenticated',
      token: data.token!,
      username: data.username!,
      name: data.name ?? null,
    };
  },

  async appleSignup(
    idToken: string,
    username: string,
    displayName?: string,
  ): Promise<GoogleAuthResponse> {
    const { data } = await client.post<GoogleAuthResponse>('/api/auth/apple/signup', {
      idToken,
      username,
      displayName,
    });
    return data;
  },

  async checkUsername(username: string): Promise<UsernameAvailability> {
    const { data } = await client.get<UsernameAvailability>('/api/auth/username/available', {
      params: { username },
    });
    return data;
  },
};
