'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CircleUser, Castle, Coins, Plus, ScrollText, ShieldCheck, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { useBillingStore } from '@/stores/billing'
import { useNotificationsStore } from '@/stores/notifications'
import { useAdminStore } from '@/stores/admin'
import { signOut } from '@/lib/api/auth'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { showSignUpCta } from '@/lib/auth/header-cta'
import { Tooltip } from '@/components/ui/tooltip'
import { MobileNav } from '@/components/features/layout/MobileNav'
import { CREATE_ITEMS, useOpenCreate } from '@/components/features/layout/CreatePanels'
import { NotificationsPanel } from '@/components/features/layout/NotificationsPanel'

// 未読バッジの更新間隔。生成の完了に程よく気づける程度に抑える。
const UNREAD_POLL_MS = 30_000

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const billingSummary = useBillingStore((s) => s.summary)
  const fetchBillingSummary = useBillingStore((s) => s.fetchSummary)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  // 運営権限の有無。バッジを出すかどうかの判断にだけ使う（守りはサーバー側）
  const adminSession = useAdminStore((s) => s.session)
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  // 「作る」は右パネルで開く。ページへ移ると、いま見ていたものが消える
  const openCreate = useOpenCreate()
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/auth/')
  const isLandingPage = pathname === '/'
  const signUpCtaVisible = showSignUpCta({ hasHydrated, isAuthenticated, pathname })
  const showUserMenu = hasHydrated && isAuthenticated

  useEffect(() => {
    if (showUserMenu) fetchBillingSummary()
  }, [showUserMenu, fetchBillingSummary])

  // 未読数を定期的に取りに行く。タブが裏にある間は叩かない（生成はサーバー側で進むので、
  // 戻ってきたときに拾えれば十分）。
  useEffect(() => {
    if (!showUserMenu) return

    const poll = () => {
      if (document.visibilityState === 'visible') fetchUnreadCount()
    }

    poll()
    const timer = setInterval(poll, UNREAD_POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [showUserMenu, fetchUnreadCount])

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // トークン切れでもclearAuthは実行する
    }
    resetItems()
    clearAuth()
    router.push('/login')
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0 relative z-30"
      // 地を濃い金にして、上に乗るものは白で通す。
      // 差し色の金（--palace）をそのまま地にすると、その上の金の要素が沈む
      style={{
        backgroundColor: 'var(--palace-deep)',
        color: 'var(--on-palace)',
      }}
    >
      {/* 左: ロゴ（常に左端）＋ モバイルのハンバーガー（認証時のみ）。
          LP へ戻る導線はアカウントメニュー内「最初のページに戻る」へ移設した。 */}
      <div className="flex items-center gap-1">
        {/* 狭い画面では**紋章だけ**にする。名前まで置くと、ハンバーガーと
            右側の操作に挟まれて収まらず、中央に逃がすとハンバーガーの上に
            重なりかけていた。名前は広い画面で出す。
            読み上げには aria-label で常に名前が残る */}
        <Link
          href={isAuthenticated ? '/entrance' : '/'}
          // 紋章と名前の間は 10px。詰めると2つで1語のように見える
          className="flex items-center gap-2.5"
          aria-label="ImagePalace ホーム"
        >
          {/* ロゴは仮置き（宮殿アイコン）。正式ロゴ確定までのプレースホルダ */}
          <Castle size={28} style={{ color: 'var(--on-palace)' }} />
          <span
            className="brand-wordmark hidden text-base leading-none tracking-wide md:inline"
            style={{ color: 'var(--on-palace)' }}
          >
            IMAGE PALACE
          </span>
          {/* 開発段階を示すバッジ。正式リリースまで表示する */}
          <span
            className="hidden rounded-full border border-white/45 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white/85 sm:inline"
            aria-label="アルファ版"
          >
            α版
          </span>
        </Link>
        {showUserMenu && <MobileNav />}
      </div>

      <div className="flex items-center gap-1.5">
        {showUserMenu && adminSession?.admin && (
          // 運営権限を持つアカウントであることを常に見えるようにする。
          // 権限のある状態に気づかないまま操作するのを防ぐためのもので、守りではない
          // （実際の判定はサーバー側で毎リクエスト行われる）。
          <Link
            href="/admin"
            title={adminSession.owner ? '運営の管理者' : '運営'}
            className="hidden rounded-full border border-white/45 bg-white/15 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-white/25 sm:inline-flex sm:items-center sm:gap-1"
          >
            <ShieldCheck size={12} />
            管理者
          </Link>
        )}
        {showUserMenu && billingSummary && (
          <Tooltip label="クレジット残高">
          <Link
            href="/billing"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm hover:bg-white/15 transition-colors"
          >
            <Coins size={16} style={{ color: 'var(--on-palace)' }} />
            <span className="font-medium tabular-nums">{billingSummary.available_credits}</span>
            <span className="text-xs text-white/75">{CREDIT_UNIT_SHORT}</span>
          </Link>
          </Tooltip>
        )}
        {/*
          作れるものの入口。
          **アトリエを開いてから選ぶ**までの間に、作る気が薄れることがある。
          どこにいても、作れるものが一覧で見えて、そのまま入れるようにする。

          開くのは**右パネル**。ページへ移ると、いま見ていたものが消える。
          作りたいのは目の前のものの続きなので、見えたまま作れるほうがよい。
          中身は CreatePanels が持つ（入口が複数あるので置き場所は1か所）。
        */}
        {showUserMenu && (
          <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
            <Tooltip label="作る">
              <DropdownMenuTrigger
                className="rounded-full p-1.5 transition-colors hover:bg-white/15"
                aria-label="作る"
              >
                <Plus size={20} style={{ color: 'var(--on-palace)' }} />
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end" sideOffset={12} className="min-w-52 translate-x-4">
              <DropdownMenuLabel>作る</DropdownMenuLabel>
              <DropdownMenuGroup>
                {CREATE_ITEMS.map((row) => (
                  <DropdownMenuItem
                    key={row.kind}
                    onClick={() => {
                      setCreateOpen(false)
                      openCreate(row.kind)
                    }}
                    className="cursor-pointer"
                  >
                    {row.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* お知らせ（生成結果・運営からの通知）。未読があれば巻物にバッジを付け、クリックで一覧パネルを開く */}
        {showUserMenu && (
          <Tooltip label={unreadCount > 0 ? `お知らせ（未読${unreadCount}件）` : 'お知らせ'}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-full p-1.5 transition-colors hover:bg-white/15"
            aria-label={unreadCount > 0 ? `お知らせ（未読${unreadCount}件）` : 'お知らせ'}
          >
            <ScrollText size={20} style={{ color: 'var(--on-palace)' }} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          </Tooltip>
        )}
        {showUserMenu ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip label="アカウント">
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-white/15 transition-colors">
              {(user?.avatar_thumb_url ?? user?.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(user?.avatar_thumb_url ?? user?.avatar_url) as string}
                  alt="プロフィールアイコン"
                  // 地が濃い金なので、丸の縁が地に溶ける。**細い囲みで輪郭を作る**
                  // （ヘッダーの文字と同じ色。ここだけ別の色にすると浮く）
                  className="size-8 rounded-full object-cover ring-1"
                  style={{ ['--tw-ring-color' as string]: 'var(--on-palace)' }}
                  decoding="async"
                />
              ) : (
                <CircleUser size={32} strokeWidth={1.5} />
              )}
            </DropdownMenuTrigger>
            </Tooltip>
            {/* 幅・余白・位置はお知らせパネルに合わせる。パネルはヘッダー直下 4px・画面右から 8px に出るので、
                トリガー（アバター）基準のこのメニューも sideOffset と translate-x で同じ位置に揃える。 */}
            <DropdownMenuContent align="end" sideOffset={12} className="min-w-56 translate-x-4">
              {/* ユーザー名（表示名が無ければメールアドレス）＋ 閉じる（パネルと同じ×） */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <span className="max-w-48 truncate">
                    {user?.name?.trim() ? user.name : (user?.email ?? 'ゲスト')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="-mr-1 rounded-md p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="閉じる"
                  >
                    <X size={14} />
                  </button>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {adminSession?.admin && (
                <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer">
                  執務室
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
                アカウント管理
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/billing')} className="cursor-pointer">
                利用と支払い
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                環境設定
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/achievements')} className="cursor-pointer">
                トロフィー
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/')} className="cursor-pointer">
                最初のページに戻る
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : signUpCtaVisible ? (
          // 検索や共有から公開の読みものに直に降りてきた人には、
          // **ここが唯一の入口**になる。空けておくと、読んだあと行き場が無い。
          // 門（login/signup）と最初のページには出さない（どちらも自前の導線を持つ）
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--palace)' }}
            >
              はじめる
            </Link>
          </div>
        ) : (
          <div className="min-w-9" aria-hidden={isAuthPage || isLandingPage} />
        )}
      </div>

      <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </header>
  )
}
