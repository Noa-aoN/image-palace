'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

/**
 * 公示板へ戻る道。
 *
 * 使い方・コラム・お知らせは、**公示板の中の3つ**として置いてある。
 * けれど各ページは公開ページなので、開いたあとに公示板へ戻る道が無かった
 * （個別の記事から一覧へは戻れるが、一覧からその先が行き止まり）。
 *
 * **ログインしている人にだけ出す。** 検索から来た初めての人に見せても、
 * 押した先はログインへ送られるだけで、読みに来た人の邪魔になる。
 * サイドバー（SignedInSidebar）と同じ考え方。
 */
export function BoardBackLink() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mark = () => setReady(true)

    if (useAuthStore.persist.hasHydrated()) {
      const id = setTimeout(mark, 0)
      return () => clearTimeout(id)
    }

    return useAuthStore.persist.onFinishHydration(mark)
  }, [])

  if (!ready || !isAuthenticated) return null

  return (
    <Link
      href="/board"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft size={16} />
      公示板へ戻る
    </Link>
  )
}
