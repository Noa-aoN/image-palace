'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api/client'
import type { AuthTokens, User } from '@/types/auth'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const accessToken = searchParams.get('access-token')
    const uid = searchParams.get('uid')
    const client = searchParams.get('client')
    const tokenType = searchParams.get('token-type') ?? 'Bearer'
    const expiry = searchParams.get('expiry') ?? ''

    if (!accessToken || !uid || !client) {
      router.replace('/login')
      return
    }

    const tokens: AuthTokens = { accessToken, uid, client, tokenType, expiry }
    useAuthStore.getState().updateTokens(tokens)

    apiClient
      .get<{ data: User }>('/api/v1/auth/validate_token')
      .then((res) => {
        setAuth(res.data.data, tokens)
        router.replace('/dashboard')
      })
      .catch(() => {
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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">認証中...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
