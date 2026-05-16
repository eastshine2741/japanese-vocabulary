import client from './client';

export interface GoogleAuthResponse {
  token: string;
  name: string;
}

export interface VerifiedIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

export type GoogleLoginResult =
  | { kind: 'authenticated'; token: string; name: string }
  | { kind: 'needsSignup'; identity: VerifiedIdentity };

export type UsernameAvailabilityReason = 'INVALID_FORMAT' | 'RESERVED' | 'TAKEN';

export interface UsernameAvailability {
  available: boolean;
  reason?: UsernameAvailabilityReason;
}

interface GoogleLoginResponseBody {
  kind: 'authenticated' | 'needsSignup';
  token?: string;
  name?: string;
  identity?: VerifiedIdentity;
}

export const authApi = {
  async googleLogin(idToken: string): Promise<GoogleLoginResult> {
    const { data } = await client.post<GoogleLoginResponseBody>('/api/auth/google', { idToken });
    if (data.kind === 'needsSignup') {
      return { kind: 'needsSignup', identity: data.identity! };
    }
    return { kind: 'authenticated', token: data.token!, name: data.name! };
  },

  async googleSignup(
    idToken: string,
    username: string,
    displayName?: string,
  ): Promise<GoogleAuthResponse> {
    const { data } = await client.post<GoogleAuthResponse>('/api/auth/google/signup', {
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
