'use client'

import { useEffect, useState } from 'react'
import { Award, Crown } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { getAchievements, type Achievements, type Medal } from '@/lib/api/achievements'

/**
 * 実績・メダル・称号。
 *
 * 数字は保存せず、記録から数え直したものが返ってくる。だから「カードを消したのに
 * 実績だけ残っている」が起きない。
 *
 * 出しているのは**いまの数と、次に届く段階まであといくつか**。
 * 達成済みだけを並べると、まだ何も取っていない人の画面が空になる。
 */
export function AchievementList() {
  const [data, setData] = useState<Achievements | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getAchievements()
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-sm text-destructive">実績を読み込めませんでした。</p>
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Crown size={20} style={{ color: 'var(--palace)' }} />
          <span className="text-lg font-semibold">{data.current_title?.label ?? '見習い'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {(['gold', 'silver', 'bronze'] as Medal[]).map((medal) => (
            <span key={medal} className="flex items-center gap-1">
              <MedalDot medal={medal} />
              {MEDAL_LABEL[medal]} {data.medals[medal]}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {data.categories.map((row) => (
          <div key={row.key} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                {row.medal ? <MedalDot medal={row.medal} /> : <Award size={14} className="text-muted-foreground" />}
                <span className="font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">{row.description}</span>
              </div>
              <span className="tabular-nums text-sm">
                {row.value.toLocaleString()} {row.unit}
              </span>
            </div>

            <Progress row={row} />

            <p className="text-xs text-muted-foreground">
              {row.next_at == null
                ? '金メダル。この部門はここまでです。'
                : `次は ${row.next_at.toLocaleString()} ${row.unit}（あと ${row.remaining?.toLocaleString()}）`}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-5">
        <h3 className="font-medium">称号</h3>
        <ul className="space-y-1.5 text-sm">
          {data.titles.map((title) => (
            <li key={title.key} className="flex items-center justify-between gap-3">
              <span className={title.earned ? '' : 'text-muted-foreground'}>
                {title.key === 'laureate' && '🏆 '}
                {title.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {title.earned ? '獲得' : `金メダル ${title.gold_required} 個`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const MEDAL_LABEL: Record<Medal, string> = { bronze: '銅', silver: '銀', gold: '金' }
// 金・銀・銅は色で伝わる。文字だけだと一覧で見分けが付かない
const MEDAL_COLOR: Record<Medal, string> = {
  bronze: '#a97142',
  silver: '#9aa3ad',
  gold: '#c6a75e',
}

function MedalDot({ medal }: { medal: Medal }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full"
      style={{ backgroundColor: MEDAL_COLOR[medal] }}
    />
  )
}

/** 次の段階までの進み具合。金まで行ったら満たした状態で止める */
function Progress({ row }: { row: Achievements['categories'][number] }) {
  const goal = row.next_at ?? row.thresholds[row.thresholds.length - 1]
  const ratio = goal > 0 ? Math.min(1, row.value / goal) : 1

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${ratio * 100}%`, backgroundColor: 'var(--palace)' }}
      />
    </div>
  )
}
