'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CircleUser, Castle, Coins } from 'lucide-react'
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
import { signOut } from '@/lib/api/auth'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { MobileNav } from '@/components/features/layout/MobileNav'

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
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/auth/')
  const isLandingPage = pathname === '/'
  const showUserMenu = hasHydrated && isAuthenticated

  useEffect(() => {
    if (showUserMenu) fetchBillingSummary()
  }, [showUserMenu, fetchBillingSummary])

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
      {/* 左: モバイルのハンバーガー（認証時のみ）＋ ロゴ */}
      <div className="flex items-center gap-1">
        {showUserMenu && <MobileNav />}
        <Link href={isAuthenticated ? '/entrance' : '/'} className="flex items-center" aria-label="ImagePalace ホーム">
          {/* ロゴは仮置き（宮殿アイコン）。正式ロゴ確定までのプレースホルダ */}
          <Castle size={32} style={{ color: 'var(--palace)' }} />
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
        {showUserMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-black/5 transition-colors">
              <CircleUser size={32} strokeWidth={1.5} />
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
