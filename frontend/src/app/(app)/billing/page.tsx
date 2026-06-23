'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Coins, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPlans, getBillingSummary, createCheckoutSession, createPortalSession } from '@/lib/api/billing'
import { tierLabel, formatYen } from '@/lib/billing'
import type { BillingPlan, BillingSummary } from '@/types/billing'

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getBillingSummary(), getPlans()])
      .then(([s, p]) => {
        if (cancelled) return
        setSummary(s)
        setPlans(p)
      })
      .catch(() => {
        if (!cancelled) setError('課金情報の取得に失敗しました。時間を置いて再度お試しください。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckout = async (planName: string) => {
    setBusyPlan(planName)
    setError(null)
    try {
      const url = await createCheckoutSession(planName)
      window.location.assign(url)
    } catch {
      setError('決済ページの作成に失敗しました。時間を置いて再度お試しください。')
      setBusyPlan(null)
    }
  }

  const handlePortal = async () => {
    setBusyPlan('__portal__')
    setError(null)
    try {
      const url = await createPortalSession()
      window.location.assign(url)
    } catch {
      setError('お支払い管理ページを開けませんでした。時間を置いて再度お試しください。')
      setBusyPlan(null)
    }
  }

  const currentTier = summary?.plan?.tier ?? 'free'
  const subscriptionPlans = plans.filter((p) => p.kind === 'subscription' && p.tier !== 'free')
  const topupPlans = plans.filter((p) => p.kind === 'one_time')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <div>
        <h1 className="text-xl font-semibold">プランと請求</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          クレジット残高の確認、プランのアップグレード、クレジットの追加ができます。
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 残高・現在のプラン */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Coins size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-base font-semibold">クレジット残高</h2>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold">{summary?.available_credits ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              現在のプラン：<span className="font-medium text-foreground">{tierLabel(currentTier)}</span>
              {summary?.subscription?.cancel_at_period_end && '（期末で解約予定）'}
            </p>
          </div>
          {summary?.subscription && (
            <Button variant="outline" onClick={handlePortal} disabled={busyPlan === '__portal__'} className="flex items-center gap-1">
              <ExternalLink size={15} />
              {busyPlan === '__portal__' ? '開いています…' : 'お支払いを管理'}
            </Button>
          )}
        </div>
      </section>

      {/* プラン（サブスク） */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-base font-semibold">プラン</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {subscriptionPlans.map((plan) => {
            const isCurrent = plan.tier === currentTier
            const busy = busyPlan === plan.name
            return (
              <div key={plan.name} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <div>
                  <p className="text-base font-semibold">{tierLabel(plan.tier)}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatYen(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground"> / 月</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">月 {plan.credits.toLocaleString('ja-JP')} クレジット</p>
                </div>
                <Button
                  onClick={() => handleCheckout(plan.name)}
                  disabled={isCurrent || busy}
                  variant={isCurrent ? 'outline' : 'default'}
                  className="mt-auto"
                >
                  {isCurrent ? '利用中' : busy ? '移動中…' : 'このプランにする'}
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      {/* クレジット追加（Top-up） */}
      {topupPlans.length > 0 && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CreditCard size={18} style={{ color: 'var(--palace)' }} />
            <h2 className="text-base font-semibold">クレジットを追加</h2>
          </div>
          <p className="text-sm text-muted-foreground">買い切りのクレジットは繰り越して使えます。</p>
          <div className="flex flex-wrap gap-3">
            {topupPlans.map((plan) => (
              <Button
                key={plan.name}
                variant="outline"
                onClick={() => handleCheckout(plan.name)}
                disabled={busyPlan === plan.name}
                className="flex items-center gap-1"
              >
                <Coins size={15} />
                {plan.credits.toLocaleString('ja-JP')} クレジット（{formatYen(plan.price)}）
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
