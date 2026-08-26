'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { isDemoUser } from '@/lib/demo/session'
import { leaveDemo } from '@/lib/api/demo'
import { useItemsStore } from '@/stores/items'

/**
 * 体験中であることを、いつも1本だけ出す帯。
 *
 * **幅を動かさない。** 前は残り時間を数えて出していたので、
 * 1分ごとに文字数が変わって帯が揺れた。残り時間はここの主役ではないし、
 * 中身は誰が入っても毎回同じで、失って困るものが無い。
 * 「消える」ことだけを、動かない文で伝える。
 *
 * 押している間も文字を変えない。**同じ理由**（変えると幅が動く）。
 *
 * **浮かせない。** ヘッダーは `relative` なので、上に浮かせると隠してしまう。
 * root の layout で、ヘッダーの上に流れの中で置く（全体が1行ぶん下がる）。
 */
export function DemoBanner() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [leaving, setLeaving] = useState(false)

  if (!hasHydrated || !isDemoUser(user)) return null

  async function handleLeave() {
    if (leaving) return
    // 中身は毎回まったく同じなので、押し間違えても失うものは無い。
    // それでも「片付く」と分かってから押せるようにする
    if (!window.confirm('体験を終えて、トップページへ戻ります。よろしいですか。')) return

    setLeaving(true)
    await leaveDemo().catch(() => {})
    useItemsStore.getState().resetItems()
    useAuthStore.getState().clearAuth()
    router.replace('/')
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1
                 px-4 py-1.5 text-center text-xs"
      style={{ backgroundColor: 'var(--palace)', color: 'var(--on-accent)' }}
      role="status"
    >
      {/* 出口を先に置く。**入ってきた人が最初に探すのは戻り道。**
          見た目は「自分の宮殿をつくる」と揃える（どちらも出口で、格は同じ）。

          **地は白で塗り切る。** 半透明の白（15%）を金の帯に重ねていたころは、
          白字とのコントラストが 2:1 ほどしか無く、**押せない釦に見えた**。
          薄い地に薄い字を載せると、いくら並べても「効いていない」と読まれる。 */}
      <button
        type="button"
        onClick={handleLeave}
        disabled={leaving}
        title="体験を終えて、トップページへ戻ります"
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-0.5
                   font-medium shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ color: 'var(--palace)' }}
      >
        <Home size={12} aria-hidden />
        トップページに戻る
      </button>

      <span>体験中の宮殿です（編集の保持は2時間だけです）</span>

      {/* **どこから来たかを伝える。** 登録の画面で
          「体験のものは引き継がれない」を先に言えるようにする */}
      <Link
        href="/signup?from=demo"
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-0.5
                   font-medium shadow-sm transition-opacity hover:opacity-90"
        style={{ color: 'var(--palace)' }}
      >
        <Sparkles size={12} aria-hidden />
        自分の宮殿をつくる
      </Link>
    </div>
  )
}
