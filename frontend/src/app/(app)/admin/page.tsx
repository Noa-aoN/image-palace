'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getAdminOverview } from '@/lib/api/admin'
import { TrendChart } from '@/components/features/shared/TrendChart'
import { AdminLimitsPanel } from '@/components/features/admin/AdminLimitsPanel'
import { AdminFinanceSummaryCard } from '@/components/features/admin/AdminFinanceSummaryCard'
import type { AdminOverview } from '@/types/admin'

/**
 * 運営（管理）ダッシュボード。
 *
 * ここでの出し分けは見た目の話であって、守りではない。
 * 権限の判定はサーバー側で毎リクエスト行われる。
 */
export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch(() => {
        if (!cancelled) setError('数字を取得できませんでした')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!overview && !error) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {overview && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">全体</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="登録ユーザー" value={overview.users.total} sub={`確認済み ${overview.users.confirmed}`} />
              <Stat
                label="直近30日の新規"
                value={overview.users.new_last_30d}
                sub={`7日 ${overview.users.new_last_7d}`}
              />
              <Stat
                label="直近30日に作った人"
                value={overview.users.active_last_30d}
                sub={rate(overview.users.active_last_30d, overview.users.total)}
              />
              <Stat label="運営メンバー" value={overview.users.admins} />
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <TrendChart points={overview.series.new_users} label="新規ユーザー" />
            <TrendChart points={overview.series.new_items} label="新規カード" />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">生成</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="カード総数" value={overview.content.items} sub={`30日 ${overview.generation.items_last_30d}`} />
              <Stat label="生成成功" value={overview.generation.by_status.completed ?? 0} />
              {/* 失敗は数だけでは多いのか分からない。割合を添える */}
              <Stat
                label="生成失敗"
                value={overview.generation.by_status.failed ?? 0}
                sub={rate(overview.generation.by_status.failed ?? 0, overview.content.items)}
              />
              <Stat
                label="画像キャッシュ率"
                value={`${overview.generation.cache_hit_rate}%`}
                sub={`共有画像 ${overview.generation.shared_medias} / 情景 ${overview.generation.shared_briefs}`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">課金</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="有料契約" value={overview.billing.active_subscriptions} />
              <Stat label="有料率" value={`${overview.billing.paid_rate}%`} />
              <Stat label="30日の消費" value={`${overview.billing.credits_consumed_last_30d} cr`} />
              {/* ここは「動き」を並べる場所。いまの残高は直下の節が持つ（同じ数を2度出さない） */}
              <Stat
                label="今月の収入"
                value={`¥${overview.finance.revenue.total.toLocaleString()}`}
                sub={overview.finance.test_revenue > 0 ? `テストの決済は除く` : undefined}
              />
            </div>
            {Object.keys(overview.billing.by_plan).length > 0 && (
              <p className="text-sm text-muted-foreground">
                プラン別:{' '}
                {Object.entries(overview.billing.by_plan)
                  .map(([name, count]) => `${name} ${count}`)
                  .join(' / ')}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">未使用クレジット</h2>
            <p className="text-sm text-muted-foreground">
              受け取ったのに、まだ提供していないぶんです。これから原価がかかる約束にあたります。
              円は「全部使われたら」の目安で、1クレジットあたりの原価から出しています。
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* 出どころで並べる。受け取ったぶん（月額・買い切り）と、
                  こちらが配ったぶん（付与）が一目で分かるようにする */}
              <Stat
                label="月額"
                value={`${overview.credit_liability.breakdown.subscription.toLocaleString()} cr`}
                sub="当月分"
              />
              <Stat
                label="買い切り"
                value={`${overview.credit_liability.breakdown.topup.toLocaleString()} cr`}
                sub={`受け取り済みで未提供 ¥${overview.credit_liability.unused_topup_value.toLocaleString()}`}
              />
              <Stat
                label="付与"
                value={`${overview.credit_liability.breakdown.grant.toLocaleString()} cr`}
                sub="お試し・繰り越し・キャンペーン"
              />
              {/* クレジットの数だけでは、いくら抱えているのか分からない。円も併せて出す */}
              <Stat
                label="合計"
                value={`${overview.credit_liability.total.toLocaleString()} cr`}
                sub={`全部使われると 約¥${overview.credit_liability.total_cost_jpy.toLocaleString()}`}
              />
              <Stat
                label="最短の失効"
                value={
                  overview.credit_liability.next_expiry_at
                    ? new Date(overview.credit_liability.next_expiry_at).toLocaleDateString('ja-JP')
                    : '—'
                }
                sub="いちばん早く消えるぶんの期限"
              />
              <Stat
                label="期限なし（旧仕様）"
                value={`${overview.credit_liability.unlimited.toLocaleString()} cr`}
                sub="期限が付く前の残り"
              />
              <Stat
                label="30日で失効"
                value={`${overview.credit_liability.expired_last_30d.toLocaleString()} cr`}
                sub="使われずに消えたぶん"
              />
            </div>
          </section>

          <section className="space-y-3">
            {/* たまっているものだけを並べる。期間の動き（AI の呼び出し）は下に分ける。
                同じ並びに混ぜると、どれが「いまの量」でどれが「30日ぶん」なのか読めなくなる */}
            <h2 className="text-lg font-semibold">たまっているもの</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="キャンバス" value={overview.content.views} />
              <Stat label="スペース" value={overview.content.spaces} />
              <Stat label="ボックス" value={overview.content.boxes} />
              <Stat label="ワードリスト" value={overview.content.wordlists} />
              <Stat label="タグ" value={overview.content.tags} />
            </div>

            <h3 className="pt-2 text-sm font-medium text-muted-foreground">AI（直近30日）</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="呼び出し"
                value={overview.ai.calls_last_30d}
                sub={`${overview.ai.tokens_last_30d.toLocaleString()} トークン`}
              />
            </div>
            {overview.ai.by_kind.length > 0 && (
              <p className="text-sm text-muted-foreground">
                内訳: {overview.ai.by_kind.map((row) => `${row.label} ${row.count}`).join(' / ')}
              </p>
            )}
          </section>

          <AdminFinanceSummaryCard summary={overview.finance} />
          <AdminLimitsPanel overview={overview} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function rate(part: number, total: number) {
  if (total <= 0) return undefined
  return `全体の ${((part / total) * 100).toFixed(1)}%`
}

