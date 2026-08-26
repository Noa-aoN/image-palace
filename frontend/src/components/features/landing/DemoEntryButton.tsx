'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { enterDemo, fetchDemoOpen, DemoUnavailableError } from '@/lib/api/demo'
import { useAuthStore } from '@/stores/auth'
import { DEMO_HOME } from '@/lib/demo/guide'
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
/** 閉じているときの言い方。**どこでも同じにする** */
const PREPARING = '体験版は現在準備中です'

export function DemoEntryButton({ label = '宮殿を見てみる' }: { label?: string }) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 入口が開いているか。**分かるまでは押せない**
  // （押せる見た目のまま断ると、押した人に無駄足を踏ませる）
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    fetchDemoOpen().then(setOpen)
  }, [])

  async function handleClick() {
    if (loading || !open) return

    setLoading(true)
    setError(null)
    try {
      const session = await enterDemo()
      resetItems()
      setAuth(session.user, session.tokens)
      // **体験はカード一覧から始める。**
      //
      // エントランスは自分の宮殿の入口で、まだ何も無い人には
      // 空の間取り図が出るだけになる。体験で見てほしいのは
      // **中身のあるカード**なので、最初からそこへ通す
      router.push(DEMO_HOME)
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
        disabled={loading || open !== true}
        title={open === false ? PREPARING : undefined}
        aria-disabled={open !== true}
        className="rounded-full border px-5 py-1.5 text-sm transition-colors
                   hover:bg-[color:var(--ivory-dark)] disabled:cursor-not-allowed disabled:opacity-60
                   focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ borderColor: 'var(--palace)', color: 'var(--ink-soft)' }}
      >
        {loading ? 'ご案内しています…' : label}
      </button>
      {/* 添える一行は、**伝えることがあるときだけ**。
          「登録は要りません」は釦が既に言っているので置かない */}
      {error ? (
        <p role="alert" className="text-xs" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : open === false ? (
        <p className="text-xs" style={{ color: '#6B6B6B' }}>
          {PREPARING}
        </p>
      ) : null}
    </div>
  )
}
