'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Gauge, ImageIcon } from 'lucide-react'
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
 * 使用量（画像の生成・文章のAI・クレジットの消費・カードの作成）。
 *
 * クレジットの合計だけでは「何に使ったのか」が分からない。画像と文章を分けて、
 * それぞれ何回・何枚使ったのかを期間を選んで確認できるようにする。
 *
 * 画像の内訳に「キャッシュで済んだ枚数」を出しているのは、同じ単語を誰かが先に
 * 作っていると生成せずに済むため。**クレジットは同じだけ消費する**ので枚数には数えるが、
 * それが何を意味するのかを書いておかないと、ただの内部事情の露出になる。
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
  const maxImageKind = Math.max(1, ...(usage?.images.by_kind ?? []).map((row) => row.count))
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
          <ImageIcon size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-lg font-semibold">画像の生成</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          カード・プロフィール・ヘッダーなどで作った画像の枚数です。1枚 1 cr。
        </p>

        {!usage ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : usage.images.total_count === 0 ? (
          <p className="text-sm text-muted-foreground">{usage.period_label}の生成はまだありません。</p>
        ) : (
          <>
            <p className="text-sm">
              {usage.period_label}で <span className="font-semibold">{usage.images.total_count.toLocaleString()}</span> 枚
            </p>

            <ul className="space-y-2">
              {usage.images.by_kind.map((row) => (
                <li key={row.kind}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{row.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.count.toLocaleString()} 枚
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.count / maxImageKind) * 100}%`, backgroundColor: 'var(--palace)' }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {usage.images.cached_count > 0 && (
              <p className="text-xs text-muted-foreground">
                うち {usage.images.cached_count.toLocaleString()} 枚は、同じ言葉の絵が既にあったため
                作らずに使いまわしています（そのぶん早く出ます）。
              </p>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-lg font-semibold">AIの利用状況</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          文章の生成（意味・タグ・ファクトチェックなど）で AI を使った回数です。1回 0.01 cr。
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
