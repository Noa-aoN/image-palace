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

function buildPasswordResetRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/reset-password`
  }

  return 'http://localhost:3000/reset-password'
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/api/v1/auth/password', {
    email,
    redirect_url: buildPasswordResetRedirectUrl(),
  })
}

export async function resetPassword(
  password: string,
  passwordConfirmation: string,
  tokens: { accessToken: string; client: string; uid: string }
): Promise<{ user: User; tokens: AuthTokens }> {
  const res = await apiClient.put<AuthResponse>(
    '/api/v1/auth/password',
    {
      password,
      password_confirmation: passwordConfirmation,
    },
    {
      headers: {
        'access-token': tokens.accessToken,
        client: tokens.client,
        uid: tokens.uid,
      },
    }
  )
  const updatedTokens = extractTokens(res.headers as Record<string, string>)
  if (!updatedTokens.accessToken || !updatedTokens.uid || !updatedTokens.client) {
    throw new Error('トークンの取得に失敗しました')
  }
  return { user: res.data.data, tokens: updatedTokens }
}

export function googleOAuthUrl(): string {
  return `${getBrowserApiBaseUrl()}/api/v1/auth/google_oauth2`
}

export function appleOAuthUrl(): string {
  return `${getBrowserApiBaseUrl()}/api/v1/auth/apple`
}
