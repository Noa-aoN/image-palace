'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleUser } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { signOut } from '@/lib/api/auth'

export function AppHeader() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // トークン切れでもclearAuthは実行する
    }
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
      {/* ロゴ */}
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

      {/* ユーザーメニュー */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full p-1 hover:bg-black/5 transition-colors">
          <CircleUser size={32} strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
