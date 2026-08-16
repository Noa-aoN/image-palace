'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

/**
 * 既に入っている人には、門（ログイン・登録）を見せない。
 *
 * 入っているのにログイン欄が出ると、「入れていないのかもしれない」と読める。
 * ブックマークや履歴、共有されたリンクから戻ってくると普通に起きる。
 *
 * `AuthGuard` の裏返し。あちらは「入っていない人を門へ送る」、こちらは
 * 「入っている人を中へ戻す」。
 *
 * 戻す先は `next` があればそこ（そのページを見に来て門へ送られた人が、
 * 入り直したあと元の場所へ帰れる）。無ければエントランス。
 *
 * `replace` を使うのは、**戻るボタンで門へ戻れてしまわない**ようにするため。
 * push だと「戻る」でまたここへ来て、また弾かれる、を繰り返す。
 *
 * 判定はストアの復元を待ってから行う。待たずに見ると、入っている人でも
 * 一瞬 false になり、門が一度光ってから消える。
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    const markHydrated = () => setHasHydrated(true)
    if (useAuthStore.persist.hasHydrated()) {
      const id = setTimeout(markHydrated, 0)
      return () => clearTimeout(id)
    }
    return useAuthStore.persist.onFinishHydration(markHydrated)
  }, [])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return
    const next = searchParams.get('next')
    // 外部サイトへは飛ばさない（`next` は誰でも付けられる）
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/entrance')
  }, [hasHydrated, isAuthenticated, router, searchParams])

  // 復元待ちと、戻している最中は門を描かない。
  // ちらりとでも出すと、入っている人に「入れていない」と読ませてしまう
  if (!hasHydrated || isAuthenticated) return null

  return <>{children}</>
}
