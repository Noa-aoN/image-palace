'use client'

import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import { getAdminBusinessMetrics } from '@/lib/api/admin'
import type { AdminBusinessMetrics } from '@/types/admin'

/**
 * 戦略（これから）。
 *
 * 「次に何をするか」を置く場所。数字を見る場所（分析）とも、
 * 日々の操作をする場所（運営）とも別に持つ。
 *
 * いまは入口だけ。**置き場所を先に決めておく**ことに意味がある。
 * 後から作る AI の見立ては、判断の材料が揃ってからでないと
 * 「まだ分からない」しか言えない。何がいつ揃うかをここに出しておく。
 */
export default function AdminStrategyPage() {
  const [data, setData] = useState<AdminBusinessMetrics | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminBusinessMetrics()
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const startedOn = data?.activity_retention?.measurement_started_on
  const started = startedOn ? new Date(startedOn) : null
  const matureOn = started ? new Date(started.getTime() + 30 * 86_400_000) : null
  const fmt = (date: Date) => date.toLocaleDateString('ja-JP')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Compass size={20} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">これから</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        数字を見る場所（分析）と、日々の操作をする場所（運営）とは別に、
        「次に何をするか」をここに置きます。
      </p>

      <section className="space-y-3 rounded-xl border border-border bg-background p-5">
        <h3 className="text-sm font-semibold">AI の見立て</h3>
        <p className="text-sm text-muted-foreground">
          準備中です。いまの数字（粗利・AI原価・1枚あたりの実原価・未使用クレジット・
          新しく来た人）だけでも見立てはできますが、
          <strong className="text-foreground">続けて使われているか</strong>が分かるまでは、
          いちばん大事な問いに答えられません。
        </p>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">継続率の計測開始</dt>
            <dd className="text-sm font-medium">{started ? fmt(started) : '未取得'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">D1 が読めるころ</dt>
            <dd className="text-sm font-medium">
              {started ? fmt(new Date(started.getTime() + 86_400_000)) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">D30 が読めるころ</dt>
            <dd className="text-sm font-medium">{matureOn ? fmt(matureOn) : '—'}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          出せない数字は「未計測」と書きます。0 とは違うことなので、混ぜません。
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-dashed border-border/70 p-5">
        <h3 className="text-sm font-semibold">ここに置く予定のもの</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>・今週の要点と、気になる変化</li>
          <li>・いちばんの課題（1件だけ）</li>
          <li>・次にやること（3〜5件。根拠と、見直す日つき）</li>
          <li>・やったことの結果（前と後）</li>
        </ul>
      </section>
    </div>
  )
}
