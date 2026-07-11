'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CircleUser, Castle, Coins, ScrollText, ArrowLeft, CheckCircle2, AlertTriangle, Megaphone } from 'lucide-react'
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
import { signOut } from '@/lib/api/auth'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { formatRelativeTime } from '@/lib/datetime'
import type { NotificationKind } from '@/lib/api/notifications'
import { MobileNav } from '@/components/features/layout/MobileNav'

// 未読バッジの更新間隔。生成の完了に程よく気づける程度に抑える。
const UNREAD_POLL_MS = 30_000

// お知らせの種別ごとのアイコン
function notificationIcon(kind: NotificationKind) {
  switch (kind) {
    case 'item_generation_completed':
      return <CheckCircle2 size={16} className="text-green-600" />
    case 'item_generation_failed':
      return <AlertTriangle size={16} className="text-red-600" />
    default:
      return <Megaphone size={16} style={{ color: 'var(--palace)' }} />
  }
}

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
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount)
  const fetchNotifications = useNotificationsStore((s) => s.fetchList)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/auth/')
  const isLandingPage = pathname === '/'
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
      style={{
        backgroundColor: 'var(--ivory)',
        borderBottom: '1px solid var(--palace)',
      }}
    >
      {/* 左: モバイルのハンバーガー（認証時のみ）＋ LP導線 ＋ ロゴ */}
      <div className="flex items-center gap-1">
        {showUserMenu && <MobileNav />}
        {/* 常にLP（トップページ）へ戻れる小さめアイコン。ロゴは認証時 /entrance へ行くため導線を分ける。
            左端寄りに置きたいので負のマージンで px を少し打ち消す。 */}
        <Link
          href="/"
          className="-ml-2 rounded-full p-1.5 hover:bg-black/5 transition-colors"
          title="トップページへ"
          aria-label="トップページ（LP）へ"
        >
          <ArrowLeft size={18} style={{ color: 'var(--foreground)' }} />
        </Link>
        <Link href={isAuthenticated ? '/entrance' : '/'} className="flex items-center gap-1.5" aria-label="ImagePalace ホーム">
          {/* ロゴは仮置き（宮殿アイコン）。正式ロゴ確定までのプレースホルダ */}
          <Castle size={32} style={{ color: 'var(--palace)' }} />
          {/* 開発段階を示すバッジ。正式リリースまで表示する */}
          <span
            className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
            aria-label="アルファ版"
          >
            α版
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        {showUserMenu && billingSummary && (
          <Link
            href="/billing"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm hover:bg-black/5 transition-colors"
            title="クレジット残高"
          >
            <Coins size={16} style={{ color: 'var(--palace)' }} />
            <span className="font-medium tabular-nums">{billingSummary.available_credits}</span>
            <span className="text-xs text-muted-foreground">{CREDIT_UNIT_SHORT}</span>
          </Link>
        )}
        {/* お知らせ（生成結果・運営からの通知）。未読があれば巻物にバッジを付ける */}
        {showUserMenu && (
          <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications() }}>
            <DropdownMenuTrigger
              className="relative rounded-full p-1.5 hover:bg-black/5 transition-colors"
              title="お知らせ"
              aria-label={unreadCount > 0 ? `お知らせ（未読${unreadCount}件）` : 'お知らせ'}
            >
              <ScrollText size={20} style={{ color: 'var(--palace)' }} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>お知らせ</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      markAllRead()
                    }}
                    className="text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    すべて既読にする
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  お知らせはありません
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="cursor-pointer flex-col items-start gap-0.5 py-2"
                      onClick={() => {
                        markRead(n.id)
                        if (n.url) router.push(n.url)
                      }}
                    >
                      <span className="flex w-full items-start gap-2">
                        <span className="mt-0.5 shrink-0">{notificationIcon(n.kind)}</span>
                        <span className={`flex-1 text-sm leading-snug ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: 'var(--palace)' }}
                            aria-label="未読"
                          />
                        )}
                      </span>
                      {n.body && <span className="line-clamp-2 pl-6 text-xs text-muted-foreground">{n.body}</span>}
                      <span className="pl-6 text-[11px] text-muted-foreground/70">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {showUserMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-black/5 transition-colors">
              {(user?.avatar_thumb_url ?? user?.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(user?.avatar_thumb_url ?? user?.avatar_url) as string}
                  alt="プロフィールアイコン"
                  className="size-8 rounded-full object-cover"
                  decoding="async"
                />
              ) : (
                <CircleUser size={32} strokeWidth={1.5} />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* ユーザー名（表示名が無ければメールアドレス） */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="max-w-56 truncate">
                  {user?.name?.trim() ? user.name : (user?.email ?? 'ゲスト')}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
                アカウント設定
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/billing')} className="cursor-pointer">
                プラン・支払い
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                環境設定
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/trophy')} className="cursor-pointer">
                トロフィー
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="min-w-9" aria-hidden={isAuthPage || isLandingPage} />
        )}
      </div>
    </header>
  )
}
