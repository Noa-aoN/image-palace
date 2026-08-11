'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAdminStore } from '@/stores/admin'

/**
 * 執務室（運営）の枠。権限の確認とページの出し入れをここでまとめる。
 *
 * ここでの出し分けは見た目の話であって、守りではない。
 * 権限の判定はサーバー側で毎リクエスト行われる。
 */
const TABS = [
  { href: '/admin', label: '概要' },
  { href: '/admin/grants', label: '付与' },
  { href: '/admin/campaigns', label: 'キャンペーン' },
  { href: '/admin/models', label: 'モデル' },
  { href: '/admin/features', label: '機能' },
  { href: '/admin/rewards', label: '獲得物' },
  { href: '/admin/finance', label: '収支' },
  { href: '/admin/users', label: '利用者' },
  { href: '/admin/posts', label: '読みもの' },
  { href: '/admin/audit', label: '監査ログ' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // ヘッダーが既に読み込んでいればそれを使い、直接開かれたときだけ取りに行く
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

  if (!session.admin) {
    return <div className="py-24 text-center text-muted-foreground">執務室は運営のみが開けます。</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-center gap-2">
        <ShieldCheck size={22} style={{ color: 'var(--palace)' }} />
        {/* サイドバーの呼び名（執務室）と揃える。入口と行き先で名前が変わると、
            同じ場所だと分からない */}
        <h1 className="text-2xl font-semibold">執務室</h1>
        <span className="text-sm text-muted-foreground">{session.owner ? '管理者' : '運営'}</span>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? 'border-[var(--palace)] font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
