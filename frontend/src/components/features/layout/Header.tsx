'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CircleUser } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { signOut } from '@/lib/api/auth'
import { MobileNav } from '@/components/features/layout/MobileNav'

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/auth/')
  const isLandingPage = pathname === '/'
  const showUserMenu = hasHydrated && isAuthenticated

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
      className="h-14 flex items-center justify-between px-6 shrink-0 z-10"
      style={{
        backgroundColor: 'var(--ivory)',
        borderBottom: '1px solid var(--palace)',
      }}
    >
      {/* 左: モバイルのハンバーガー（認証時のみ）＋ ロゴ */}
      <div className="flex items-center gap-1">
        {showUserMenu && <MobileNav />}
        <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-palace.svg"
            alt="ImagePalace"
            width={36}
            height={36}
            className="block"
          />
        </Link>
      </div>

      {showUserMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full p-1 hover:bg-black/5 transition-colors">
            <CircleUser size={32} strokeWidth={1.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
              アカウント設定
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="min-w-9" aria-hidden={isAuthPage || isLandingPage} />
      )}
    </header>
  )
}
