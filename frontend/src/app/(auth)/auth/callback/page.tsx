'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { apiClient } from '@/lib/api/client'
import type { AuthTokens, User } from '@/types/auth'

// トークンはURLフラグメント(#)で受け取る。
// クエリパラメータ(?)ではなくフラグメントを使う理由:
// - フラグメントはサーバーに送信されないためアクセスログに残らない
// - Refererヘッダーにも含まれない
// - useSearchParams() は不要なため Suspense ラッパーも不要
export default function AuthCallbackPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const hash = window.location.hash.slice(1) // 先頭の # を除去
    const params = new URLSearchParams(hash)

    const accessToken = params.get('access-token')
    const uid = params.get('uid')
    const client = params.get('client')
    const tokenType = params.get('token-type') ?? 'Bearer'
    const expiry = params.get('expiry') ?? ''

    if (!accessToken || !uid || !client) {
      router.replace('/login')
      return
    }

    const tokens: AuthTokens = { accessToken, uid, client, tokenType, expiry }
    useAuthStore.getState().updateTokens(tokens)

    apiClient
      .get<{ data: User }>('/api/v1/auth/validate_token')
      .then((res) => {
        useItemsStore.getState().resetItems()
        setAuth(res.data.data, tokens)
        router.replace('/entrance')
      })
      .catch(() => {
        useItemsStore.getState().resetItems()
        useAuthStore.getState().clearAuth()
        router.replace('/login')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-muted-foreground">認証中...</p>
    </div>
  )
}
