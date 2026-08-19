'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { isDemoUser, remainingLabel } from '@/lib/demo/session'

/**
 * 体験中であることを、いつも1本だけ出す帯。
 *
 * **消えることを隠さない。** 残り時間を出すのは急かすためではなく、
 * あとで「保存されていなかった」と気づく形にしないため。
 *
 * 置き方は保存失敗の知らせに揃える（root の layout に置く）。
 * `(app)` の layout は `relative isolate` を持っていて、
 * そこに置くと重なりの順が閉じ込められる。
 */
export function DemoBanner() {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [remaining, setRemaining] = useState<string | null>(null)

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

  if (!isDemo) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1
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
    </div>
  )
}
