import { apiClient } from '@/lib/api/client'
import { readResumeToken, saveResumeToken } from '@/lib/demo/session'
import type { AuthTokens, User } from '@/types/auth'

type DemoResponse = {
  reused: boolean
  user: User
  tokens: Record<string, string>
  resume_token: string
  expires_at: string
}

export type DemoSession = {
  user: User
  tokens: AuthTokens
  expiresAt: string
  /** さっきの宮殿へ戻ったのか、新しく建ったのか */
  reused: boolean
}

/** 混み合っていて、いまは建てられない */
export class DemoUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DemoUnavailableError'
  }
}

/**
 * 体験用の宮殿に入る。
 *
 * 手元に合鍵があれば一緒に送る。**生きている宮殿があれば、新しく建てずに戻る。**
 */
export async function enterDemo(): Promise<DemoSession> {
  try {
    const res = await apiClient.post<DemoResponse>('/api/v1/demo', {
      resume_token: readResumeToken(),
    })

    saveResumeToken(res.data.resume_token)

    return {
      user: res.data.user,
      tokens: normalizeTokens(res.data.tokens),
      expiresAt: res.data.expires_at,
      reused: res.data.reused,
    }
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: { error?: string } } }).response
    if (response?.status === 503) {
      throw new DemoUnavailableError(
        response.data?.error ?? 'いまは混み合っています。しばらくしてからお試しください'
      )
    }
    throw error
  }
}

/** サーバーが返すヘッダー名を、画面が使う形へ揃える */
function normalizeTokens(raw: Record<string, string>): AuthTokens {
  return {
    accessToken: raw['access-token'],
    uid: raw.uid,
    client: raw.client,
    tokenType: raw['token-type'] ?? 'Bearer',
    expiry: raw.expiry ?? '',
  }
}
