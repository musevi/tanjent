import { apiClient } from './client';

export interface UserOut {
  id: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const register = (email: string, password: string) =>
  apiClient.post<TokenResponse>('/auth/register', { email, password });

export const login = (email: string, password: string) =>
  apiClient.post<TokenResponse>('/auth/login', { email, password });

export const getMe = () => apiClient.get<UserOut>('/auth/me');
