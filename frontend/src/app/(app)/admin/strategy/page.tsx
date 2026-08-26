'use client'

import { useEffect, useState } from 'react'
import { Check, Compass, History, ListTodo, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getAdminBrief,
  generateAdminBrief,
  getAdminBriefs,
  getAdminBriefActions,
  updateAdminBriefAction,
} from '@/lib/api/admin'
import type { AdminBrief, AdminBriefAction } from '@/types/admin'

const LEVEL_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高' }

/**
 * 戦略（AI分析）。
 *
 * 「次に何をするか」を置く場所。数字を見る場所（分析）とも、
 * 日々の操作をする場所（運営）とも別に持つ。
 *
 * **開くだけでは作らない。** 明示的に更新したときだけ AI を呼ぶ。
 * 見るだけの人が費用を積み上げないため。
 *
 * まだ「万能の経営AI」のようには見せない。**測れていないものは、
 * 測れていないと出す**。数字が揃うほど、言えることが増えていく。
 */
export default function AdminStrategyPage() {
  const [brief, setBrief] = useState<AdminBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 過去のぶん。**新しいものが上**。何を言われて何をやったかは、並べて初めて追える
  const [history, setHistory] = useState<AdminBrief[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAdminBrief()
      .then((next) => {
        if (!cancelled) setBrief(next)
      })
      .catch(() => {
        if (!cancelled) setError('見立てを読み込めませんでした')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openHistory = async () => {
    setShowHistory((current) => !current)
    if (history.length === 0) setHistory(await getAdminBriefs().catch(() => []))
  }

  const refresh = async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    try {
      const next = await generateAdminBrief()
      // 失敗しても前の見立ては壊さない（返ってきたときだけ入れ替える）
      if (next) setBrief(next)
    } catch {
      setError('AI の呼び出しに失敗しました。時間をおいてお試しください。')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Compass size={20} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">AI分析</h2>
        <ActionPanel />
        <Button size="sm" variant="ghost" onClick={openHistory} className="ml-auto">
          <History size={14} className="mr-1" />
          これまでの分析
        </Button>
        <Button size="sm" variant="outline" onClick={refresh} disabled={generating}>
          {generating ? (
            <Loader2 size={14} className="mr-1 animate-spin" />
          ) : (
            <RefreshCw size={14} className="mr-1" />
          )}
          {generating ? '考えています…' : 'AI分析を更新'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        数字は先にこちらで確定させ、AI には
        <strong className="text-foreground">その意味と、どれから手を付けるか</strong>
        だけを考えてもらいます。AI に計算はさせません。
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> 読み込んでいます
        </div>
      ) : brief ? (
        <BriefView brief={brief} />
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
          まだ見立てはありません。「AI分析を更新」を押すと、いまの数字から作ります。
        </p>
      )}

      {showHistory && <BriefHistory briefs={history} />}
    </div>
  )
}

function BriefView({ brief }: { brief: AdminBrief }) {
  const generatedAt = new Date(brief.generated_at)
  const from = new Date(brief.period.from)
  const to = new Date(brief.period.to)
  const fmt = (date: Date) => date.toLocaleDateString('ja-JP')
  const retention = brief.completeness?.retention

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {generatedAt.toLocaleString('ja-JP')} 作成 ・ 対象 {fmt(from)}〜{fmt(to)} ・ {brief.model} ・
        費用 {brief.cost_credits} cr
      </p>

      {/* 何が測れていないかを、いちばん上に置く。
          「言われなかったこと」を「問題が無かったこと」と読まれないように */}
      <section className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">まだ測れていないもの</p>
        {retention?.status && (
          <p>
            継続率（
            {Object.entries(retention.status)
              .filter(([, value]) => value !== 'measured')
              .map(([key]) => key.toUpperCase())
              .join(' / ') || 'なし'}
            ）… {retention.measurement_started_on ?? '—'} から計測
          </p>
        )}
        <p>登録から使い始めるまでの流れ・機能ごとの利用状況・キャンペーンの効果 … 未計測</p>
      </section>

      <Block title="今週の要点" items={brief.summary.highlights} />
      <Block title="気になる変化" items={brief.summary.changes} />

      {brief.summary.top_issue && (
        <section className="space-y-1 rounded-xl border border-[var(--palace)]/40 bg-[var(--palace)]/5 p-4">
          <h3 className="text-sm font-semibold">いちばんの課題</h3>
          <p className="text-sm">{brief.summary.top_issue}</p>
        </section>
      )}

      <Block title="次にやること" items={brief.summary.actions} ordered />

      {brief.insights.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">見立て</h3>
          {brief.insights.map((insight) => (
            <div key={insight.id} className="space-y-2 rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-medium">{insight.observation}</p>

              {/* 根拠を必ず出す。**根拠の見えない見立ては、次の判断に使えない** */}
              <ul className="space-y-0.5">
                {insight.evidence.map((line) => (
                  <li key={line} className="text-xs text-muted-foreground">
                    ・{line}
                  </li>
                ))}
              </ul>

              <p className="text-sm">{insight.suggested_action}</p>

              <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground">
                <span>確信度 {LEVEL_LABEL[insight.confidence] ?? insight.confidence}</span>
                <span>効き目 {LEVEL_LABEL[insight.impact] ?? insight.impact}</span>
                <span>急ぎ {LEVEL_LABEL[insight.urgency] ?? insight.urgency}</span>
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Block({ title, items, ordered }: { title: string; items?: string[]; ordered?: boolean }) {
  if (!items?.length) return null

  const List = ordered ? 'ol' : 'ul'
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <List className={`space-y-1 text-sm ${ordered ? 'list-inside list-decimal' : ''}`}>
        {items.map((line) => (
          <li key={line}>{ordered ? line : `・${line}`}</li>
        ))}
      </List>
    </section>
  )
}

/**
 * これまでの分析。**新しいものが上。**
 *
 * 何を言われて、何をやったかは、並べて初めて追える。
 * 差分の比較や折れ線はまだ持たない（見るものが増えるほど、読まなくなる）。
 */
function BriefHistory({ briefs }: { briefs: AdminBrief[] }) {
  if (briefs.length === 0) {
    return <p className="text-sm text-muted-foreground">これまでの分析はまだありません。</p>
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">これまでの分析</h3>
      <ul className="space-y-2">
        {briefs.map((brief) => {
          const done = (brief.actions ?? []).filter((a) => a.status === 'done').length
          const total = (brief.actions ?? []).length
          const immature = Object.entries(brief.completeness?.retention?.status ?? {})
            .filter(([, value]) => value !== 'measured')
            .map(([key]) => key.toUpperCase())

          return (
            <li key={brief.id} className="rounded-xl border border-border bg-background p-3">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">
                      {new Date(brief.generated_at).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(brief.period.from).toLocaleDateString('ja-JP')}〜
                      {new Date(brief.period.to).toLocaleDateString('ja-JP')}
                    </span>
                    <span className="text-xs text-muted-foreground">{brief.model}</span>
                    <span className="text-xs text-muted-foreground">{brief.cost_credits} cr</span>
                    {total > 0 && (
                      <span className="text-xs text-muted-foreground">
                        やること {done}/{total}
                      </span>
                    )}
                    {/* 何が測れていなかったかを並べる。
                        言われなかったことを「問題が無かった」と読まないため */}
                    {immature.length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-500">
                        未計測 {immature.join(' / ')}
                      </span>
                    )}
                  </div>
                  {brief.summary.top_issue && (
                    <p className="mt-1 text-sm">{brief.summary.top_issue}</p>
                  )}
                </summary>

                <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                  <Block title="今週の要点" items={brief.summary.highlights} />
                  <Block title="気になる変化" items={brief.summary.changes} />
                  <Block title="次にやること" items={(brief.actions ?? []).map((a) => a.title)} ordered />
                  {brief.insights.map((insight) => (
                    <div key={insight.id} className="space-y-1">
                      <p className="text-sm font-medium">{insight.observation}</p>
                      <ul>
                        {insight.evidence.map((line) => (
                          <li key={line} className="text-xs text-muted-foreground">
                            ・{line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const ACTION_FILTERS = [
  { key: 'open', label: '未完了' },
  { key: 'done', label: '完了' },
  { key: 'all', label: 'すべて' },
] as const

/**
 * 「次にやること」を横から開く。
 *
 * **終わったものを消さない。** やったことも、やらなかったことも、次の見立ての材料になる。
 * 既定は未完了（開いた人がまず見たいのは、まだ残っているもの）。
 */
function ActionPanel() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [rows, setRows] = useState<AdminBriefAction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // 読み込み中の印は次の順番へ回す。効果の中でそのまま書き換えると、
    // 描き直しが連鎖する形になる
    const spinner = setTimeout(() => setLoading(true), 0)
    getAdminBriefActions(filter)
      .then((next) => {
        if (!cancelled) setRows(next)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(spinner)
    }
  }, [open, filter])

  const toggle = async (row: AdminBriefAction) => {
    const next = row.status === 'done' ? 'open' : 'done'
    // 押した瞬間に変える。戻ってくるのを待つと、押せたのかが分からない
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
    try {
      await updateAdminBriefAction(row.id, next)
      if (filter !== 'all') setRows((current) => current.filter((r) => r.id !== row.id))
    } catch {
      setRows((current) => current.map((r) => (r.id === row.id ? { ...r, status: row.status } : r)))
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <ListTodo size={14} className="mr-1" />
        やること
      </Button>

      {open && (
        <div className="w-full space-y-2 rounded-xl border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {ACTION_FILTERS.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setFilter(row.key)}
                aria-pressed={filter === row.key}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  filter === row.key
                    ? 'border-transparent text-white'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={filter === row.key ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {row.label}
              </button>
            ))}
            {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {filter === 'open' ? '残っているものはありません。' : 'ありません。'}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(row)}
                    aria-pressed={row.status === 'done'}
                    aria-label={row.status === 'done' ? '未完了に戻す' : '完了にする'}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      row.status === 'done' ? 'border-transparent text-white' : 'border-border'
                    }`}
                    style={row.status === 'done' ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    {row.status === 'done' && <Check size={11} strokeWidth={3} />}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm ${row.status === 'done' ? 'text-muted-foreground line-through' : ''}`}
                    >
                      {row.title}
                    </span>
                    {/* いつ言われたことか。古いまま残っているものに気づける */}
                    {row.generated_at && (
                      <span className="block text-2xs text-muted-foreground">
                        {new Date(row.generated_at).toLocaleDateString('ja-JP')} の分析
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
