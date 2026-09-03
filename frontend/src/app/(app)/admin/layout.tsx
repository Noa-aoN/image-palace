'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminStrongAuthGate } from '@/components/features/admin/AdminStrongAuthGate'
import { ROLE_LABELS } from '@/lib/admin-roles'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAdminStore } from '@/stores/admin'

/**
 * 執務室（運営）の枠。権限の確認とページの出し入れをここでまとめる。
 *
 * ここでの出し分けは見た目の話であって、守りではない。
 * 権限の判定はサーバー側で毎リクエスト行われる。
 */
/**
 * 執務室の大分類。**そこで何をするか**で分ける。
 *
 * **執務室は管理画面そのものの名前**で、分類と並べない（上の帯に置く）。
 * 並ぶのはその中身。
 *
 *   概要   … いま何が起きているか（最初に開く）
 *   分析   … 数字を見る（読むだけ・変えない）
 *   運営   … 日々の操作（人・物・お知らせ）
 *   戦略   … 次に何をするか
 *   システム … 設定と安全（壊せるもの）
 *
 * 横1列に11枚並べていたころは、見るものと変えるものが同じ列にあった。
 * 増えるたびに列が詰まり、どれが危ない操作なのかも読めない。
 *
 * **URL は変えていない。** 並べ方だけを変える。既存のリンクと監査ログの参照を
 * 壊さないため。整理は別の機会に、行き先の付け替えとして行う。
 */
const SECTIONS = [
  // 概要だけは中を持たない。**執務室を開いて最初に見る場所**なので、
  // 一段挟むと、開くたびに1回多く押すことになる
  { key: 'overview', label: '概要', items: [{ href: '/admin', label: '概要' }] },
  {
    key: 'analytics',
    label: '分析',
    items: [
      { href: '/admin/business', label: '経営' },
      { href: '/admin/finance', label: '収支' },
    ],
  },
  {
    key: 'ops',
    label: '運営',
    items: [
      { href: '/admin/users', label: '利用者' },
      { href: '/admin/campaigns', label: 'キャンペーン' },
      { href: '/admin/rewards', label: '獲得物' },
      { href: '/admin/posts', label: '読みもの' },
    ],
  },
  { key: 'strategy', label: '戦略', items: [{ href: '/admin/strategy', label: 'AI分析' }] },
  {
    key: 'system',
    label: 'システム',
    items: [
      // 中身はプラン価格・利用上限・付与ポリシー。扱う対象で呼ぶ
      { href: '/admin/grants', label: '料金と枠' },
      { href: '/admin/models', label: 'AIモデル' },
      { href: '/admin/features', label: '機能管理' },
      { href: '/admin/audit', label: '監査ログ' },
    ],
  },
]

/** いまいる場所がどの大分類か。/admin だけは前方一致にしない（全部に当たるため） */
function sectionOf(pathname: string) {
  const match = SECTIONS.find((section) =>
    section.items.some((item) =>
      item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
    )
  )
  return match ?? SECTIONS[0]
}


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

  // 一次認証のうえで、もう一度ご本人か確かめる。
  // まだ求めない設定のときは、この節ごと素通りする（これまでどおり）
  const strongAuth = session.strong_auth
  if (strongAuth?.required && !strongAuth.satisfied) {
    // 求めているときは prepared も一緒に返る。
    // 万一欠けていたら「持っていない」と見て、設定へ案内する側に倒す
    return <AdminStrongAuthGate onDone={fetchSession} />
  }

  const section = sectionOf(pathname)

  return (
    <div className="min-h-full">
      {/*
        ここが奥の部屋だと、一目で分かるようにする。
        **色だけに頼らない。** 盾の印と「執務室」の文字も置く
        （色だけだと、色で見分けない人には普通の画面と同じに見える）。
      */}
      <header className="border-b border-[var(--palace)]/40 bg-[color-mix(in_srgb,var(--palace)_14%,var(--background))]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3">
          <ShieldCheck size={20} style={{ color: 'var(--palace)' }} />
          {/* サイドバーの呼び名（執務室）と揃える。入口と行き先で名前が変わると、
              同じ場所だと分からない */}
          <h1 className="text-lg font-semibold">執務室</h1>
          {/* 4段階あるので「管理者か否か」では足りない。いまの段階をそのまま出す */}
          <span className="text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</span>
          <StrongAuthRemaining expiresAt={strongAuth?.expires_at ?? null} />
        </div>

        {/* 大分類。そこで何をするかで分ける（見る / 操作する / 設定する） */}
        <nav className="mx-auto max-w-6xl overflow-x-auto px-6">
          <div className="flex gap-1">
            {SECTIONS.map((s) => {
              const active = s.key === section.key
              return (
                <Link
                  key={s.key}
                  href={s.items[0].href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                    active
                      ? 'border-[var(--palace)] font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* 小分類。1枚しか無い大分類では出さない（同じ名前が2つ並ぶだけになる） */}
        {section.items.length > 1 && (
          <nav className="flex flex-wrap gap-1">
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    active
                      ? 'bg-[var(--palace)] text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}

        {children}
      </div>
    </div>
  )
}

/**
 * 強い確認の残り時間。
 *
 * 出しておかないと、作業の途中で急に閉め出されたように見える。
 * 大きく出す必要はない。**あと少しだと分かればよい**ので、残り5分を切ったときだけ色を変える。
 */
function StrongAuthRemaining({ expiresAt }: { expiresAt: string | null }) {
  const [minutes, setMinutes] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return

    const tick = () => {
      const left = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000)
      setMinutes(left > 0 ? left : 0)
    }
    // 最初の1回も次の順番へ回す。効果の中でそのまま書き換えると、
    // 描き直しが連鎖する形になる
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [expiresAt])

  if (minutes === null) return null

  return (
    <span
      className={`ml-auto text-xs ${minutes <= 5 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}
    >
      強い確認 あと{minutes}分
    </span>
  )
}
