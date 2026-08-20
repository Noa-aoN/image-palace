'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { isDemoUser, remainingLabel } from '@/lib/demo/session'
import { leaveDemo } from '@/lib/api/demo'
import { useItemsStore } from '@/stores/items'

/**
 * 体験中であることを、いつも1本だけ出す帯。
 *
 * **消えることを隠さない。** 残り時間を出すのは急かすためではなく、
 * あとで「保存されていなかった」と気づく形にしないため。
 *
 * **浮かせない。** ヘッダーは `relative` なので、上に浮かせると隠してしまう。
 * root の layout で、ヘッダーの上に流れの中で置く（全体が1行ぶん下がる）。
 */
export function DemoBanner() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [remaining, setRemaining] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const isDemo = hasHydrated && isDemoUser(user)

  useEffect(() => {
    if (!isDemo) return

    // 入居日から寿命を数える。サーバーが返した消える時刻と同じ考え方
    const update = () => {
      const created = user?.created_at
      if (!created) return setRemaining(null)

      const expires = new Date(new Date(created).getTime() + 24 * 60 * 60 * 1000)
      setRemaining(remainingLabel(expires.toISOString()))
    }
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [isDemo, user?.created_at])

  async function handleLeave() {
    if (leaving) return
    // 中身は毎回まったく同じなので、押し間違えても失うものは無い。
    // それでも「消える」と分かってから押せるようにする
    if (!window.confirm('この体験用の宮殿を片付けます。よろしいですか。')) return

    setLeaving(true)
    await leaveDemo().catch(() => {})
    useItemsStore.getState().resetItems()
    useAuthStore.getState().clearAuth()
    router.replace('/')
  }

  if (!isDemo) return null

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1
                 px-4 py-1.5 text-center text-xs"
      style={{ backgroundColor: 'var(--palace)', color: '#fff' }}
      role="status"
    >
      <span>体験中の宮殿です{remaining ? `（${remaining}で消えます）` : ''}</span>
      <Link
        href="/signup"
        className="rounded-full bg-white/15 px-3 py-0.5 font-medium underline-offset-2 hover:bg-white/25"
      >
        自分の宮殿を作る
      </Link>
      {/* 出口。**主役は「自分の宮殿を作る」のまま**なので、控えめに置く */}
      <button
        type="button"
        onClick={handleLeave}
        disabled={leaving}
        className="rounded-full px-2 py-0.5 underline underline-offset-2 opacity-80
                   hover:opacity-100 disabled:opacity-50"
      >
        {leaving ? '片付けています…' : '体験を終える'}
      </button>
    </div>
  )
}
