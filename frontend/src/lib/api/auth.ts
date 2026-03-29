import { apiClient } from './client'
import type { User, AuthTokens } from '@/types/auth'

interface AuthResponse {
  data: User
}

function extractTokens(headers: Record<string, string>): AuthTokens {
  return {
    accessToken: headers['access-token'] ?? '',
    uid: headers['uid'] ?? '',
    client: headers['client'] ?? '',
    tokenType: headers['token-type'] ?? 'Bearer',
    expiry: headers['expiry'] ?? '',
  }
}

export async function signUp(
  email: string,
  password: string,
  passwordConfirmation: string
): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await apiClient.post<AuthResponse>('/api/v1/auth', {
    email,
    password,
    password_confirmation: passwordConfirmation,
  })
  return { user: res.data.data, tokens: extractTokens(res.headers as Record<string, string>) }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await apiClient.post<AuthResponse>('/api/v1/auth/sign_in', {
    email,
    password,
  })
  return { user: res.data.data, tokens: extractTokens(res.headers as Record<string, string>) }
}

export async function signOut(): Promise<void> {
  await apiClient.delete('/api/v1/auth/sign_out')
}

export function googleOAuthUrl(): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/google_oauth2`
}
