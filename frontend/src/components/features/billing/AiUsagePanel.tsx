'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { getAiUsage } from '@/lib/api/billing'
import type { AiUsageSummary } from '@/types/billing'

/**
 * 画像以外の AI 利用の内訳。
 *
 * 画像はクレジットで数えられるが、意味・タグ・ファクトチェックといった文章の生成は
 * どれだけ使っているのかが見えていなかった。何にどれだけ使ったかを本人が確認できるようにする。
 *
 * 現状これらは無料枠で提供している。将来この画面の数字を見て、
 * 高いものだけに単価を付けられるようにしてある。
 */
export function AiUsagePanel() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAiUsage()
      .then((data) => {
        if (!cancelled) setUsage(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return null

  const max = Math.max(1, ...(usage?.breakdown ?? []).map((row) => row.count))

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">AIの利用状況</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        画像の生成以外（意味・タグ・ファクトチェックなど）で AI を使った回数です。
        現在これらはクレジットを消費しません。
      </p>

      {!usage ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : usage.total_count === 0 ? (
        <p className="text-sm text-muted-foreground">直近{usage.days}日間の利用はまだありません。</p>
      ) : (
        <>
          <p className="text-sm">
            直近{usage.days}日間で <span className="font-semibold">{usage.total_count.toLocaleString()}</span> 回
            {usage.total_credits > 0 && <>（{usage.total_credits.toFixed(2)} cr）</>}
          </p>

          <ul className="space-y-2">
            {usage.breakdown.map((row) => (
              <li key={row.kind}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{row.count.toLocaleString()} 回</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(row.count / max) * 100}%`, backgroundColor: 'var(--palace)' }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {usage.daily_cap > 0 && (
            <p className="text-xs text-muted-foreground">
              連続した誤操作を防ぐため、1日 {usage.daily_cap.toLocaleString()} 回までにしています
              （直近24時間: {usage.used_today.toLocaleString()} 回）。
            </p>
          )}
        </>
      )}
    </section>
  )
}
