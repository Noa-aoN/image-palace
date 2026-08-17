import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { isPublicPath } from '@/lib/auth/public-paths'
import {
  buildSessionEndRecord,
  loginPathWithNotice,
  markSessionEnded,
  reportSessionEnd,
} from '@/lib/auth/session-end'

const AUTH_ERROR_EXCLUDED_PATHS = new Set([
  '/api/v1/auth',
  '/api/v1/auth/sign_in',
])

function resolveApiBaseUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL
}

export function getBrowserApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens
  if (tokens?.accessToken && tokens.uid && tokens.client) {
    config.headers['access-token'] = tokens.accessToken
    config.headers['uid'] = tokens.uid
    config.headers['client'] = tokens.client
    config.headers['token-type'] = tokens.tokenType
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const accessToken = response.headers['access-token']
    if (accessToken) {
      useAuthStore.getState().updateTokens({
        accessToken,
        uid: response.headers['uid'] ?? '',
        client: response.headers['client'] ?? '',
        tokenType: response.headers['token-type'] ?? 'Bearer',
        expiry: response.headers['expiry'] ?? '',
      })
    }
    return response
  },
  (error) => {
    const requestUrl = error.config?.url as string | undefined
    const path = requestUrl ? new URL(requestUrl, resolveApiBaseUrl()).pathname : undefined
    const shouldRedirectOnUnauthorized = path ? !AUTH_ERROR_EXCLUDED_PATHS.has(path) : true

    if (error.response?.status === 401 && shouldRedirectOnUnauthorized) {
      // ログイン無しで読めるページからは追い出さない。
      // 印は落とす（ヘッダーは未ログインの姿に変わる）が、いま読んでいるものは残す。
      // 送っていたころは、使い方やコラムを読んでいる最中に期限が切れると、
      // 読みかけの記事からログイン画面へ飛ばされていた
      const pathname = window.location.pathname
      const redirected = !isPublicPath(pathname)

      // **落とす前に期限を控える。** clearAuth のあとでは、
      // そのとき何を持っていたのかが分からなくなる
      const tokenExpiry = useAuthStore.getState().tokens?.expiry ?? null

      useItemsStore.getState().resetItems()
      useAuthStore.getState().clearAuth()
      // 認証が外れたことに気づいた側（AuthGuard）が先に送ることがある。
      // どちらが送っても同じ案内を出せるよう、切れたことを先に印しておく
      if (redirected) markSessionEnded()

      reportSessionEnd(
        buildSessionEndRecord({
          pathname,
          // **pathname だけを載せる。** requestUrl にはクエリが付く。
          // いまは載る値に秘密は無いが、あとで付いたものが記録へ流れ込む道を作らない
          api: path ?? '(不明)',
          tokenExpiry,
          redirected,
          now: new Date(),
        })
      )

      if (redirected) {
        // なぜログイン画面に居るのかを URL で渡す（読んだ側が印を消す）
        window.location.href = loginPathWithNotice()
      }
    }
    return Promise.reject(error)
  }
)
