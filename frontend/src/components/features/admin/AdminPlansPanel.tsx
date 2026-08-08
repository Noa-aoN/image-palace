'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getAdminPlans, updateAdminPlan } from '@/lib/api/admin'
import type { AdminPlan } from '@/types/admin'

/**
 * プラン（ユーザー種類）ごとの付与クレジット。
 *
 * 変えられるのは付与量と有効/無効だけ。価格は Stripe の Price を作り直すことになり
 * 既存の契約者にも影響するため、ここからは触らせない。
 * 付与を増やしすぎると原価割れするので、粗利の下限はサーバー側で検証している。
 */
export function AdminPlansPanel() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [minMargin, setMinMargin] = useState(0)
  const [costPerCredit, setCostPerCredit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminPlans()
      .then((data) => {
        if (cancelled) return
        setPlans(data.plans)
        setMinMargin(data.min_margin)
        setCostPerCredit(data.cost_per_credit)
      })
      .catch(() => {
        if (!cancelled) setError('プランを取得できませんでした')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save(plan: AdminPlan, credits: number) {
    setSavingId(plan.id)
    setError(null)
    try {
      const updated = await updateAdminPlan(plan.id, { credits_per_period: credits })
      setPlans((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (e) {
      const messages = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setError(messages?.join(' / ') ?? '保存できませんでした')
      // 弾かれた値が残らないよう取り直す
      getAdminPlans()
        .then((data) => setPlans(data.plans))
        .catch(() => undefined)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center py-12 text-muted-foreground">
        <Loader2 size={18} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">ユーザー種類ごとのクレジット</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          月額プランの付与量。原価の見立ては1クレジット {costPerCredit} 円、粗利の下限は{' '}
          {Math.round(minMargin * 100)}%。下回る付与は保存できない。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-normal">プラン</th>
              <th className="px-4 py-2 text-right font-normal">月額</th>
              <th className="px-4 py-2 text-right font-normal">付与</th>
              <th className="px-4 py-2 text-right font-normal">1枚あたり</th>
              <th className="px-4 py-2 text-right font-normal">粗利率</th>
              <th className="px-4 py-2 text-left font-normal">状態</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2">
                  {plan.name}
                  {plan.tier && <span className="ml-2 text-xs text-muted-foreground">{plan.tier}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {plan.price === null ? '—' : `¥${plan.price.toLocaleString()}`}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    defaultValue={plan.credits_per_period}
                    disabled={savingId === plan.id}
                    onBlur={(e) => {
                      const next = Number(e.target.value)
                      if (Number.isFinite(next) && next !== plan.credits_per_period) save(plan, next)
                    }}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right tabular-nums"
                  />
                </td>
                {/* 価格 ÷ 付与。原価（1クレジット {costPerCredit} 円）と直接比べられる */}
                <td className="px-4 py-2 text-right tabular-nums">
                  {plan.price && plan.credits_per_period > 0
                    ? `¥${(plan.price / plan.credits_per_period).toFixed(1)}`
                    : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {plan.margin === null ? '—' : `${plan.margin}%`}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {plan.active ? '有効' : '停止'}
                  {plan.stripe_linked && ' / Stripe 連携済み'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        価格はここから変えられない。変えると Stripe の Price を作り直すことになり、既存の契約者に影響が及ぶため。
      </p>
    </section>
  )
}
