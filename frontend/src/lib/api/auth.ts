import { apiClient, getBrowserApiBaseUrl } from './client'
import type { User, AuthTokens } from '@/types/auth'

interface AuthResponse {
  data: User
}

function buildConfirmSuccessUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/login`
  }

  return 'http://localhost:3000/login'
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
    confirm_success_url: buildConfirmSuccessUrl(),
  })
  const tokens = extractTokens(res.headers as Record<string, string>)
  if (!tokens.accessToken || !tokens.uid || !tokens.client) throw new Error('トークンの取得に失敗しました')
  return { user: res.data.data, tokens }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await apiClient.post<AuthResponse>('/api/v1/auth/sign_in', {
    email,
    password,
  })
  const tokens = extractTokens(res.headers as Record<string, string>)
  if (!tokens.accessToken || !tokens.uid || !tokens.client) throw new Error('トークンの取得に失敗しました')
  return { user: res.data.data, tokens }
}

export async function signOut(): Promise<void> {
  await apiClient.delete('/api/v1/auth/sign_out')
}

export function googleOAuthUrl(): string {
  return `${getBrowserApiBaseUrl()}/api/v1/auth/google_oauth2`
}
