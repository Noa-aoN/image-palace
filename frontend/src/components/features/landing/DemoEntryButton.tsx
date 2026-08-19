'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enterDemo, DemoUnavailableError } from '@/lib/api/demo'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

/**
 * 登録せずに宮殿を見る入口。
 *
 * **主役は「無料ではじめる」のまま。** 大きさも太さも色も弱くしてあり、
 * 2つのボタンの下に一段落として置く。下の小さな一行が押す理由を担う。
 *
 * 押すとその場で宮殿が建ち、通常の画面へそのまま入る。
 * 一度入った人がまた押したときは、**新しく建てずにさっきの宮殿へ戻る**。
 */
export function DemoEntryButton({ label = '宮殿を見てみる' }: { label?: string }) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (loading) return

    setLoading(true)
    setError(null)
    try {
      const session = await enterDemo()
      resetItems()
      setAuth(session.user, session.tokens)
      router.push('/entrance')
    } catch (e) {
      setError(
        e instanceof DemoUnavailableError
          ? e.message
          : '宮殿をご案内できませんでした。時間を置いてお試しください'
      )
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full border px-5 py-1.5 text-sm transition-colors
                   hover:bg-[color:var(--ivory-dark)] disabled:opacity-60
                   focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ borderColor: 'var(--palace)', color: '#4A4A4A' }}
      >
        {loading ? 'ご案内しています…' : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs" style={{ color: '#9E3226' }}>
          {error}
        </p>
      ) : (
        <p className="text-xs" style={{ color: '#6B6B6B' }}>
          登録は要りません
        </p>
      )}
    </div>
  )
}
