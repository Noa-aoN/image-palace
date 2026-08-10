'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  getAdminFinance,
  updateAdminCostParameter,
  updateAdminMonthlyActual,
} from '@/lib/api/admin'
import type { AdminCostParameter, AdminFinancePage, AdminFinanceSummary } from '@/types/admin'

const GROUP_LABELS: Record<string, string> = {
  exchange: '為替',
  payment: '決済',
  image: '画像の単価',
  text: '文章の単価',
  infra: 'インフラ（月額）',
  other: 'その他',
}

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`

/**
 * 支出入の概算。
 *
 * 収入は実績なので確度が高い。支出は「実回数 × 単価」で、回数は正確（image_usages /
 * ai_usages）だが単価は設定値なので、そこが誤差になる。請求実額を入れて乖離を見せ、
 * 単価を直せるようにしてある。
 */
export function AdminFinancePanel() {
  const [page, setPage] = useState<AdminFinancePage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // null = 未選択（今月）、'all' = 全期間（開業からの総計を出す）
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null)
  const [allPeriod, setAllPeriod] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAdminFinance(selected ?? undefined)
      .then((data) => {
        if (!cancelled) setPage(data)
      })
      .catch(() => {
        if (!cancelled) setError('取得できませんでした')
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  async function saveParameter(parameter: AdminCostParameter, value: number) {
    setSavingKey(parameter.key)
    setError(null)
    try {
      const updated = await updateAdminCostParameter(parameter.key, { value })
      setPage((prev) =>
        prev
          ? { ...prev, parameters: prev.parameters.map((row) => (row.key === updated.key ? updated : row)) }
          : prev
      )
      // 単価が変われば概算も変わる。取り直して画面を合わせる
      const refreshed = await getAdminFinance(selected ?? undefined)
      setPage(refreshed)
    } catch {
      setError('保存できませんでした')
    } finally {
      setSavingKey(null)
    }
  }

  async function saveActual(summary: AdminFinanceSummary, values: { openai_jpy: number; infra_jpy: number; other_jpy: number }) {
    setSavingKey('actual')
    try {
      const updated = await updateAdminMonthlyActual(summary.period.year ?? 0, summary.period.month ?? 0, values)
      setPage((prev) => (prev ? { ...prev, summary: updated } : prev))
    } catch {
      setError('保存できませんでした')
    } finally {
      setSavingKey(null)
    }
  }

  if (!page) {
    return (
      <div className="flex items-center py-12 text-muted-foreground">
        {error ? error : (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" /> 読み込み中…
          </>
        )}
      </div>
    )
  }

  // 「全期間」を選んだら、月の概算の代わりに総計を出す
  const summary = allPeriod ? page.totals : page.summary
  const { parameters } = page
  const grouped = page.groups.map((group) => ({
    group,
    rows: parameters.filter((row) => row.group === group),
  }))

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {allPeriod
                ? `全期間の概算（${page.totals.period.from} 〜 ${page.totals.period.to}・${page.totals.months}か月）`
                : `${summary.period.year}年${summary.period.month}月の概算`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              収入は実績。支出は「実回数 × 単価」の概算で、回数は正確・単価は設定値（為替 {summary.fx} 円/USD）。
            </p>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">対象の月</span>
            <select
              value={allPeriod ? 'all' : `${page.summary.period.year}-${page.summary.period.month}`}
              onChange={(e) => {
                if (e.target.value === 'all') {
                  setAllPeriod(true)
                  return
                }
                const [year, month] = e.target.value.split('-').map(Number)
                setAllPeriod(false)
                setSelected({ year, month })
              }}
              className="rounded-lg border border-border bg-background px-2 py-1"
            >
              <option value="all">全期間</option>
              {page.available_months.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.year}年{m.month}月
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* テストの決済は売上に入れない。ただし黙って落とすと「決済したのに 0 円」に見えるので断る */}
        {summary.test_revenue > 0 && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            この期間には、テスト（サンドボックス）の決済 {yen(summary.test_revenue)} があります。
            収入には数えていません。
            {summary.mode === 'テスト' && <>　いまの決済はテスト用の鍵で動いています。</>}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="収入" value={yen(summary.revenue.total)} sub="本番の決済のみ" />
          <Stat label="支出（概算）" value={yen(summary.cost.total)} />
          <Stat
            label="差引"
            value={yen(summary.profit)}
            tone={summary.profit < 0 ? 'bad' : undefined}
            sub={summary.margin === null ? undefined : `粗利率 ${summary.margin}%`}
          />
          <Stat label="画像生成" value={`${summary.cost.image.count} 枚`} sub={yen(summary.cost.image.jpy)} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Breakdown
            title="支出の内訳"
            rows={[
              { label: '決済手数料', value: summary.cost.stripe_fee },
              { label: `画像生成（${summary.cost.image.count}枚）`, value: summary.cost.image.jpy },
              { label: `文章生成（${summary.cost.text.calls}回）`, value: summary.cost.text.jpy },
              { label: 'インフラ', value: summary.cost.infra },
            ]}
          />
          <Breakdown
            title="収入の内訳"
            rows={Object.entries(summary.revenue.by_kind).map(([kind, value]) => ({ label: kind, value }))}
            empty="この月の決済はまだありません"
          />
        </div>

        {(summary.cost.image.breakdown.length > 0 || summary.cost.text.breakdown.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {summary.cost.image.breakdown.length > 0 && (
              <Breakdown
                title="画像（モデル別）"
                rows={summary.cost.image.breakdown.map((row) => ({
                  label: `${row.model}${row.quality ? `/${row.quality}` : ''}・${row.kind} ×${row.count}`,
                  value: row.jpy,
                }))}
              />
            )}
            {summary.cost.text.breakdown.length > 0 && (
              <Breakdown
                title="文章（モデル別）"
                rows={summary.cost.text.breakdown.map((row) => ({
                  label: `${row.model} ×${row.calls}（${(row.prompt_tokens + row.completion_tokens).toLocaleString()}トークン）`,
                  value: row.jpy,
                }))}
              />
            )}
          </div>
        )}
      </section>

      {!allPeriod && (
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">開業からの総計</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.totals.period.from} 〜 {page.totals.period.to}（{page.totals.months} か月）。
            インフラは月額 × {page.totals.months} か月で見積もっている。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="収入（累計）" value={yen(page.totals.revenue.total)} />
          <Stat label="支出（累計・概算）" value={yen(page.totals.cost.total)} />
          <Stat
            label="差引（累計）"
            value={yen(page.totals.profit)}
            tone={page.totals.profit < 0 ? 'bad' : undefined}
            sub={page.totals.margin === null ? undefined : `粗利率 ${page.totals.margin}%`}
          />
          <Stat label="画像（累計）" value={`${page.totals.cost.image.count} 枚`} sub={yen(page.totals.cost.image.jpy)} />
        </div>
      </section>
      )}

      {/* 請求実額は月ごとに入れるものなので、全期間のときは出さない */}
      {!allPeriod && <ActualForm summary={page.summary} saving={savingKey === 'actual'} onSave={saveActual} />}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">単価・レート</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            外の都合で変わる値。触っていない項目はコード側の既定で動いている。
          </p>
        </div>

        {grouped.map(({ group, rows }) =>
          rows.length === 0 ? null : (
            <div key={group} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{GROUP_LABELS[group] ?? group}</p>
              <div className="mt-2 space-y-1.5">
                {rows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={row.description ?? undefined}>
                      {row.label}
                      {row.customized && <span className="ml-1.5 text-xs text-muted-foreground">設定済み</span>}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      defaultValue={row.value}
                      disabled={savingKey === row.key}
                      onBlur={(e) => {
                        const next = Number(e.target.value)
                        if (Number.isFinite(next) && next !== row.value) saveParameter(row, next)
                      }}
                      className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-right tabular-nums"
                    />
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">{row.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </section>
    </div>
  )
}

// 請求実額。概算との差を見て単価を直すためのもの
function ActualForm({
  summary,
  saving,
  onSave,
}: {
  summary: AdminFinanceSummary
  saving: boolean
  onSave: (summary: AdminFinanceSummary, values: { openai_jpy: number; infra_jpy: number; other_jpy: number }) => void
}) {
  const [openai, setOpenai] = useState(summary.actual.openai ?? 0)
  const [infra, setInfra] = useState(summary.actual.infra ?? 0)
  const [other, setOther] = useState(summary.actual.other ?? 0)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">請求の実額</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          請求書の金額を入れると、概算との乖離が出る。単価を直す手がかりになる。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="OpenAI" value={openai} onChange={setOpenai} />
          <Field label="インフラ" value={infra} onChange={setInfra} />
          <Field label="その他" value={other} onChange={setOther} />
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(summary, { openai_jpy: openai, infra_jpy: infra, other_jpy: other })}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="mt-3 text-sm">
          {summary.actual.recorded ? (
            <p>
              概算 {yen(summary.actual.estimated)} / 実額 {yen(summary.actual.actual ?? 0)}
              <span className={summary.actual.diff && summary.actual.diff > 0 ? 'ml-2 text-destructive' : 'ml-2 text-muted-foreground'}>
                差 {yen(summary.actual.diff ?? 0)}
                {summary.actual.diff_rate !== null && summary.actual.diff_rate !== undefined
                  ? `（${summary.actual.diff_rate > 0 ? '+' : ''}${summary.actual.diff_rate}%）`
                  : ''}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              未入力。概算では外部への支払いが {yen(summary.actual.estimated)} の見込み（決済手数料を除く）。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm">
      <span className="block text-xs text-muted-foreground">{label}（円）</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-32 rounded-lg border border-border bg-background px-2 py-1 text-right tabular-nums"
      />
    </label>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'bad' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string
  rows: { label: string; value: number }[]
  empty?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty ?? '—'}</p>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate text-muted-foreground">{row.label}</dt>
              <dd className="tabular-nums">{yen(row.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
