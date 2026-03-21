export interface AuthRequest {
  name: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}
