'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { getProfile } from '@/lib/api/account'
import { loginPathWithNotice, sessionEndedJustNow } from '@/lib/auth/session-end'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const updateUser = useAuthStore((s) => s.updateUser)

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
    if (!hasHydrated || isAuthenticated) return

    // いま期限切れで落ちたのなら、ログイン画面で理由を出せるようにして送る。
    // 何も言わずに戻すと、操作を失敗したように見える
    router.replace(sessionEndedJustNow() ? loginPathWithNotice() : '/login')
  }, [hasHydrated, isAuthenticated, router])

  // 認証済みになったら一度プロフィールを取得し、アバターをストアに反映する
  // （ヘッダー等でアバターを全ページ表示するため。ログインレスポンスには含まれない）。
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return
    getProfile()
      .then((p) =>
        updateUser({
          avatar_url: p.avatar_url,
          avatar_thumb_url: p.avatar_thumb_url,
          avatar_generation_status: p.avatar_generation_status,
          created_at: p.created_at,
        })
      )
      .catch(() => {})
  }, [hasHydrated, isAuthenticated, updateUser])

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
