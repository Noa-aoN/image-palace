'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // lazy initializer で同期的に現在の hydration 状態を取得する。
  // useState に関数参照を渡すと React が初回のみ呼び出す（useEffect 不要）。
  const [hasHydrated, setHasHydrated] = useState(() => {
    if (typeof window === 'undefined') return false
    return useAuthStore.persist.hasHydrated()
  })

  useEffect(() => {
    // onFinishHydration は外部システムへの購読なので、
    // コールバック内での setState は lint ルール上も問題ない。
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true))
  }, [])

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.replace('/login')
  }, [hasHydrated, isAuthenticated, router])

  if (!hasHydrated) return null
  if (!isAuthenticated) return null
  return <>{children}</>
}
