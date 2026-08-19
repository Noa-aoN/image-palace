'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DemoEntryButton } from '@/components/features/landing/DemoEntryButton'
import { signOut } from '@/lib/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

/**
 * LP の CTA ボタン。ログイン有無で出し分ける（ヒーローと最下部の再入口で共用）。
 * ハイドレーション確定前は認証UIを出さない（Header と同じ hasHydrated 方式でちらつき防止）。
 */
/**
 * CTA ひとまとまり。ボタンの並びの**下に一段落として**、
 * 登録せずに見る入口を小さく置く。既存の並びは変えない。
 *
 * 出すのは未ログインのときだけ（入っている人には要らない）。
 */
export function LandingCtaGroup({ className = '' }: { className?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  return (
    <div className="flex flex-col items-center gap-5">
      <LandingCta className={className} />
      {hasHydrated && !isAuthenticated ? <DemoEntryButton /> : null}
    </div>
  )
}

export function LandingCta({ className = '' }: { className?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)
  const showAuthed = hasHydrated && isAuthenticated

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // トークン切れでも clearAuth は実行する
    }
    resetItems()
    clearAuth()
    // LP 上なのでリダイレクトせず、CTA が未ログイン向けに切り替わるだけにする。
  }

  return (
    <div className={`${className} ${hasHydrated ? '' : 'invisible'}`}>
      {showAuthed ? (
        <>
          <Link href="/entrance" className="w-full sm:w-44">
            <Button
              size="lg"
              className="w-full px-8 text-base sm:w-44"
              style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
            >
              宮殿に入る
            </Button>
          </Link>
          <Button size="lg" variant="outline" onClick={handleLogout} className="w-full px-8 text-base sm:w-44">
            ログアウト
          </Button>
        </>
      ) : (
        <>
          <Link href="/signup" className="w-full sm:w-44">
            <Button
              size="lg"
              className="w-full px-8 text-base sm:w-44"
              style={{ backgroundColor: 'var(--palace)', color: '#fff', border: 'none' }}
            >
              無料ではじめる
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-44">
            <Button size="lg" variant="outline" className="w-full px-8 text-base sm:w-44">
              ログイン
            </Button>
          </Link>
        </>
      )}
    </div>
  )
}
