'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Coins, Sparkles, Loader2, ExternalLink, Gauge, History, HardDrive, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { getPlans, getBillingSummary, createCheckoutSession, createPortalSession } from '@/lib/api/billing'
import { useBillingStore } from '@/stores/billing'
import { tierLabel, formatYen, CREDIT_UNIT, CREDIT_UNIT_SHORT } from '@/lib/billing'
import type { BillingPlan, BillingSummary } from '@/types/billing'

type TabKey = 'usage' | 'plan' | 'credit' | 'capacity' | 'payment'

// クレジット更新（回復）日を "YYYY/M/D" に整形。null/不正は null。
function formatRenewal(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<'success' | 'cancel' | null>(null)

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

  // Stripe からの戻り（?checkout=success/cancel）を検知。
  // webhook は非同期なので、成功時はサマリーを数回ポーリングして反映を待つ（手動リロード不要に）。
  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get('checkout')
    if (checkout !== 'success' && checkout !== 'cancel') return
    window.history.replaceState(null, '', window.location.pathname)

    let cancelled = false
    let tries = 0
    // subscription.created（プラン）と invoice.paid（クレジット）は別イベントで前後するため、
    // 早期終了せず数回ポーリングして両方の反映を取り込む。ヘッダー等の共有残高も更新する。
    const poll = async () => {
      tries += 1
      try {
        const s = await getBillingSummary()
        if (cancelled) return
        setSummary(s)
        useBillingStore.getState().fetchSummary()
      } catch {
        /* 一時的な失敗は次のポーリングで吸収 */
      }
      if (!cancelled && tries < 5) setTimeout(poll, 2000)
    }

    // effect 本体での同期 setState を避けるため、表示・ポーリングは次タスクで開始する。
    const notice = setTimeout(() => {
      if (cancelled) return
      setCheckoutNotice(checkout)
      if (checkout === 'success') setTimeout(poll, 1500)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(notice)
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
  const renewal = formatRenewal(summary?.subscription?.current_period_end ?? summary?.next_credit_reset)
  const renewalLabel = summary?.subscription ? '次回更新日' : '次回回復日'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" /> 読み込み中…
      </div>
    )
  }

  const sections: CategorySection<TabKey>[] = [
    {
      key: 'usage',
      label: '利用状況',
      icon: <Gauge size={16} />,
      content: (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Coins size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">クレジット残高</h2>
            </div>
            <p className="text-3xl font-bold">
              {summary?.available_credits ?? 0}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{CREDIT_UNIT}</span>
            </p>
            {summary?.credit_breakdown && (
              <dl className="grid gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">
                    サブスク枠
                    {renewal && <span className="ml-1 text-xs">（{renewal} 更新でリセット）</span>}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {summary.credit_breakdown.subscription} {CREDIT_UNIT_SHORT}
                  </dd>
                </div>
                {summary.credit_breakdown.grant > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">
                      特典クレジット（期限つき）
                      {summary.credit_breakdown.grant_expires_at && (
                        <span className="ml-1 text-xs">
                          （{formatRenewal(summary.credit_breakdown.grant_expires_at)} まで）
                        </span>
                      )}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {summary.credit_breakdown.grant} {CREDIT_UNIT_SHORT}
                    </dd>
                  </div>
                )}
                {summary.credit_breakdown.topup > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">チャージ（買い切り）</dt>
                    <dd className="font-medium tabular-nums">
                      {summary.credit_breakdown.topup} {CREDIT_UNIT_SHORT}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">現在のプラン</dt>
                <dd className="font-medium">
                  {tierLabel(currentTier)}
                  {summary?.subscription?.cancel_at_period_end && '（期末で解約予定）'}
                </dd>
              </div>
              {renewal && (
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-muted-foreground">{renewalLabel}</dt>
                  <dd className="font-medium tabular-nums">{renewal}</dd>
                </div>
              )}
            </dl>
          </section>

          <ComingSoon
            title="使用量の推移"
            icon={<Gauge size={18} />}
            description="今月の使用量や、消費の推移グラフは順次対応予定です。"
            items={['今月の使用量', '消費の推移', '失効予定の通知']}
          />
        </>
      ),
    },
    {
      key: 'plan',
      label: 'プラン管理',
      icon: <Sparkles size={16} />,
      content: (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">プラン</h2>
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

          {summary?.subscription && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">プラン変更・解約</h2>
              <p className="text-sm text-muted-foreground">
                プランの変更・解約、契約ステータスの確認は、お支払い管理ページ（Stripe）から行えます。
                {summary.subscription.cancel_at_period_end && ' 現在、期末での解約が予定されています。'}
              </p>
              <Button variant="outline" onClick={handlePortal} disabled={busyPlan === '__portal__'} className="flex items-center gap-1">
                <ExternalLink size={15} />
                {busyPlan === '__portal__' ? '開いています…' : 'お支払いを管理'}
              </Button>
            </section>
          )}
        </>
      ),
    },
    {
      key: 'credit',
      label: 'クレジット管理',
      icon: <History size={16} />,
      content: (
        <>
          {topupPlans.length > 0 && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <CreditCard size={18} style={{ color: 'var(--palace)' }} />
                <h2 className="text-lg font-semibold">クレジットを追加</h2>
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

          <ComingSoon
            title="クレジット履歴"
            icon={<History size={18} />}
            description="消費・回復の履歴や、失効予定の表示は順次対応予定です。"
            items={['クレジット履歴', '消費履歴', '回復履歴', '失効予定']}
          />
        </>
      ),
    },
    {
      key: 'capacity',
      label: '容量・上限',
      icon: <HardDrive size={16} />,
      content: (
        <ComingSoon
          description="保存カード数・画像容量・各種上限の表示は順次対応予定です。"
          items={['キャビネット / パレスサイズ', '保存カード数', '画像保存容量', 'ボックス / スペース上限', '公開数上限']}
        />
      ),
    },
    {
      key: 'payment',
      label: '支払い管理',
      icon: <Receipt size={16} />,
      content: (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Receipt size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">お支払い管理</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              支払い方法の変更・請求履歴・領収書は、Stripe のお支払い管理ページから確認できます。
            </p>
            {summary?.subscription ? (
              <Button variant="outline" onClick={handlePortal} disabled={busyPlan === '__portal__'} className="flex items-center gap-1">
                <ExternalLink size={15} />
                {busyPlan === '__portal__' ? '開いています…' : 'お支払いを管理'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                有料プランの契約後に、お支払い管理ページが利用できます。
              </p>
            )}
          </section>

          <ComingSoon
            title="請求情報"
            icon={<Receipt size={18} />}
            description="アプリ内での請求履歴・領収書の表示は順次対応予定です。"
            items={['支払い方法', '請求履歴', '領収書', '支払い失敗時の案内']}
          />
        </>
      ),
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <CreditCard size={26} style={{ color: 'var(--palace)' }} />
          プラン・支払い
        </h1>
        <p className="mt-2 text-muted-foreground">
          クレジット残高の確認、プランのアップグレード、クレジットの追加ができます。
        </p>
      </div>

      {checkoutNotice === 'success' && (
        <p className="rounded-lg border border-[var(--palace)]/40 bg-[rgba(198,167,94,0.08)] px-4 py-3 text-sm">
          決済が完了しました。プランの反映を確認しています…（数秒かかる場合があります）
        </p>
      )}
      {checkoutNotice === 'cancel' && (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          決済はキャンセルされました。
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <CategorySections sections={sections} ariaLabel="プラン・支払いカテゴリ" />
      </div>
    </div>
  )
}
