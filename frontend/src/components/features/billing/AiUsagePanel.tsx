'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrendChart } from '@/components/features/shared/TrendChart'
import { getAiUsage } from '@/lib/api/billing'
import {
  USAGE_METRICS,
  USAGE_PERIODS,
  type UsageMetric,
  type UsagePeriod,
  type UsageSummary,
} from '@/types/billing'

/**
 * 使用量（AIの利用・クレジットの消費・カードの作成）。
 *
 * 画像はクレジットで数えられるが、意味・タグ・ファクトチェックといった文章の生成は
 * どれだけ使っているのかが見えていなかった。期間を選んで確認できるようにする。
 *
 * 現状これらは無料枠で提供している。将来この画面の数字を見て、
 * 高いものだけに単価を付けられるようにしてある。
 */
export function AiUsagePanel() {
  const [period, setPeriod] = useState<UsagePeriod>('month')
  const [metric, setMetric] = useState<UsageMetric>('credits')
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAiUsage(period)
      .then((data) => {
        if (!cancelled) setUsage(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  if (error) return null

  const maxKind = Math.max(1, ...(usage?.ai.by_kind ?? []).map((row) => row.count))
  const series = usage ? USAGE_METRICS[metric].pick(usage) : []

  return (
    <>
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge size={18} style={{ color: 'var(--palace)' }} />
            <h2 className="text-lg font-semibold">使用量の推移</h2>
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(USAGE_PERIODS) as UsagePeriod[]).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={period === key ? 'default' : 'outline'}
                onClick={() => setPeriod(key)}
              >
                {USAGE_PERIODS[key]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(USAGE_METRICS) as UsageMetric[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={metric === key ? 'default' : 'outline'}
              onClick={() => setMetric(key)}
            >
              {USAGE_METRICS[key].label}
            </Button>
          ))}
        </div>

        {!usage ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : (
          <TrendChart
            points={series}
            label={`${USAGE_METRICS[metric].label}（${usage.period_label}）`}
            unit={USAGE_METRICS[metric].unit}
          />
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-lg font-semibold">AIの利用状況</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          画像の生成以外（意味・タグ・ファクトチェックなど）で AI を使った回数です。
        </p>

        {!usage ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : usage.ai.total_count === 0 ? (
          <p className="text-sm text-muted-foreground">{usage.period_label}の利用はまだありません。</p>
        ) : (
          <>
            <p className="text-sm">
              {usage.period_label}で <span className="font-semibold">{usage.ai.total_count.toLocaleString()}</span> 回
              {usage.ai.total_credits > 0 && <>（{usage.ai.total_credits.toFixed(2)} cr）</>}
            </p>

            <ul className="space-y-2">
              {usage.ai.by_kind.map((row) => (
                <li key={row.kind}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{row.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.count.toLocaleString()} 回
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.count / maxKind) * 100}%`, backgroundColor: 'var(--palace)' }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {usage.ai.daily_cap > 0 && (
              <p className="text-xs text-muted-foreground">
                連続した誤操作を防ぐため、1日 {usage.ai.daily_cap.toLocaleString()} 回までにしています
                （直近24時間: {usage.ai.used_today.toLocaleString()} 回）。
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}
