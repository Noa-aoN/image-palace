'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Hammer, Loader2 } from 'lucide-react'
import { useAdminStore } from '@/stores/admin'
import { can } from '@/lib/auth/capabilities'
import { AdminStrongAuthGate } from '@/components/features/admin/AdminStrongAuthGate'

/**
 * 工房室の枠。
 *
 * **執務室とは別の場所にする。** あちらは運営の仕事（人・お金・設定）で、
 * ここは制作。同じ枠に入れると、デザイナーに利用者一覧が見えることになる。
 *
 * ここでの出し分けは見た目の話であって、守りではない。
 * 判定はサーバー側で毎リクエスト行われる。
 */
const TABS = [
  { href: '/studio', label: '概要', exact: true },
  { href: '/studio/originals', label: '原本' },
  { href: '/studio/demo', label: '体験宮殿設定' },
  { href: '/studio/delivery', label: '個別配布設定' },
  { href: '/studio/settings', label: '全体設定' },
]

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const session = useAdminStore((s) => s.session)
  const fetchSession = useAdminStore((s) => s.fetchSession)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (session) return
    let cancelled = false
    fetchSession().finally(() => {
      if (!cancelled && !useAdminStore.getState().session) setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [session, fetchSession])

  if (failed) {
    return <div className="py-24 text-center text-muted-foreground">権限を確認できませんでした</div>
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  if (!can(session, 'access_official_studio')) {
    return <div className="py-24 text-center text-muted-foreground">工房室は制作の権限を持つ方のみが開けます。</div>
  }

  // 一次認証のうえで、もう一度ご本人か確かめる。**執務室と同じ関門を使う。**
  //
  // ここは公開まで届く場所。合鍵ひとつで公開まで開くのを避ける。
  // まだ求めない設定（既定）のときは、この節ごと素通りする
  const strongAuth = session.strong_auth
  if (strongAuth?.required && !strongAuth.satisfied) {
    return (
      <AdminStrongAuthGate
        onDone={fetchSession}
        room="工房室"
        reason="公式コンテンツを扱うため、もう一度ご本人か確かめさせてください。"
        preparation="工房室は公開まで届く場所なので、ログインに加えてもう一度ご本人か確かめています。"
      />
    )
  }

  return (
    <div className="min-h-full">
      {/* 執務室と同じ作りにしつつ、**印と色を変える**。
          どちらの奥の部屋に居るのかが、一目で分かるように */}
      <header className="border-b border-[var(--palace)]/40 bg-[color-mix(in_srgb,var(--palace)_8%,var(--background))]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3">
          <Hammer size={20} style={{ color: 'var(--palace)' }} />
          <h1 className="text-lg font-semibold">工房室</h1>
          <span className="text-xs text-muted-foreground">
            公式コンテンツを選んで、確かめて、公開する
          </span>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-6">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                    active
                      ? 'border-[var(--palace)] font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">{children}</div>
    </div>
  )
}
