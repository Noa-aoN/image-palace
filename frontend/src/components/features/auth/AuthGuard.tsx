'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // SSR とクライアント初期レンダリングの両方で false から始める（hydration mismatch 防止）。
  // useEffect 内でのみ window に依存した値を参照する。
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    const markHydrated = () => setHasHydrated(true)

    if (useAuthStore.persist.hasHydrated()) {
      // 既にhydration済みの場合はタイマー経由でsetStateをコールバックに委ねる
      const id = setTimeout(markHydrated, 0)
      return () => clearTimeout(id)
    }

    return useAuthStore.persist.onFinishHydration(markHydrated)
  }, [])

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.replace('/login')
  }, [hasHydrated, isAuthenticated, router])

  // Hydration 完了前: ローディング表示（ヘッダー/サイドバーは外側で既に表示済み）
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!isAuthenticated) return null
  return <>{children}</>
}
