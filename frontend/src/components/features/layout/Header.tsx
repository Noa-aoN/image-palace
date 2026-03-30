'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { signOut } from '@/lib/api/auth'

export function Header() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // トークン切れでも clearAuth は実行する
    }
    clearAuth()
    router.push('/login')
  }

  return (
    <header
      className="border-b px-6 py-4 flex items-center justify-between"
      style={{ backgroundColor: 'var(--ivory)', borderColor: '#E3E6EA' }}
    >
      <Link href={isAuthenticated ? '/dashboard' : '/'} className="text-xl font-semibold tracking-wide">
        ImagePalace
      </Link>
      <nav className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link href="/dashboard">
              <Button variant="ghost" className="text-sm">
                ダッシュボード
              </Button>
            </Link>
            <Link href="/items/new">
              <Button
                variant="outline"
                className="text-sm"
                style={{ borderColor: 'var(--palace)', color: 'var(--palace)' }}
              >
                + カードを作成
              </Button>
            </Link>
            <Button variant="ghost" className="text-sm" onClick={handleLogout}>
              ログアウト
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost" className="text-sm">
                ログイン
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                variant="outline"
                className="text-sm"
                style={{ borderColor: 'var(--palace)', color: 'var(--palace)' }}
              >
                はじめる
              </Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
