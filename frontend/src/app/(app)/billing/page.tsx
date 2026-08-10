'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Coins, Sparkles, Loader2, ExternalLink, Gauge, History, HardDrive, Receipt, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { CreditHistoryPanel } from '@/components/features/billing/CreditHistoryPanel'
import { AiUsagePanel } from '@/components/features/billing/AiUsagePanel'
import { RedeemCodePanel } from '@/components/features/billing/RedeemCodePanel'
import {
  getPlans,
  getBillingSummary,
  createCheckoutSession,
  createPortalSession,
  syncCheckout,
} from '@/lib/api/billing'
import { useBillingStore } from '@/stores/billing'
import {
  tierLabel,
  TIER_NOTES,
  TOPUP_VALIDITY,
  formatYen,
  unitPrice,
  discountPercent,
  CREDIT_UNIT,
} from '@/lib/billing'
import {
  CreditBreakdownPanel,
  CreditBreakdownButton,
} from '@/components/features/billing/CreditBreakdownPanel'
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
  const [reconciling, setReconciling] = useState(false)
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null)
  // 決済後の反映状況。confirming=確認中 / applied=反映済み / slow=時間がかかっている
  const [applyState, setApplyState] = useState<'confirming' | 'applied' | 'slow' | null>(null)

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
  //
  // webhook を待つだけだと、届かない環境ではいつまでも反映されない
  // （開発機で決済すると webhook は本番へ飛ぶ）。戻り先に載っている決済 id で
  // その場で取り込みを頼み、そのうえで従来どおりサマリーを数回ポーリングする。
  // 取り込みと webhook は同じ鍵で反映するので、両方走っても二重にはならない。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    const sessionId = params.get('session_id')
    if (checkout !== 'success' && checkout !== 'cancel') return
    window.history.replaceState(null, '', window.location.pathname)

    let cancelled = false
    let tries = 0
    // subscription.created（プラン）と invoice.paid（クレジット）は別イベントで前後するため、
    // 早期終了せず数回ポーリングして両方の反映を取り込む。ヘッダー等の共有残高も更新する。
    // 決済前のプランを控え、変化したかどうかで反映を判定する
    let before: string | null | undefined
    const poll = async () => {
      tries += 1
      try {
        const s = await getBillingSummary()
        if (cancelled) return
        if (before === undefined) before = s.plan?.name ?? null
        setSummary(s)
        useBillingStore.getState().fetchSummary()
        if ((s.plan?.name ?? null) !== before) {
          setApplyState('applied')
          return // 反映を確認できたら止める
        }
      } catch {
        /* 一時的な失敗は次のポーリングで吸収 */
      }
      if (cancelled) return
      if (tries < 5) setTimeout(poll, 2000)
      // 打ち切り。反映済みかどうか判断できないので、確認手段を案内する
      else setApplyState('slow')
    }

    // effect 本体での同期 setState を避けるため、表示・ポーリングは次タスクで開始する。
    const notice = setTimeout(() => {
      if (cancelled) return
      setCheckoutNotice(checkout)
      if (checkout === 'success') {
        setApplyState('confirming')
        // 取り込みが済んでからポーリングすれば、たいてい1回目で反映が確認できる
        const start = () => {
          if (!cancelled) poll()
        }
        // id が載っていない戻り方をしても、直近の支払いから拾えるので必ず試す
        syncCheckout(sessionId ?? undefined).then(start).catch(start)
      }
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(notice)
    }
  }, [])

  // 決済したのに残高が変わらないときの受け皿。
  // 直近の支払いを Stripe に問い合わせ、まだ入っていないものを反映する。
  // 反映済みのものは素通りするので、何度押しても二重にはならない。
  const handleReconcile = async () => {
    setReconciling(true)
    setReconcileNotice(null)
    try {
      const result = await syncCheckout()
      const fresh = await getBillingSummary()
      setSummary(fresh)
      useBillingStore.getState().fetchSummary()
      setReconcileNotice(result.applied ? '支払いを反映しました。' : '未反映の支払いはありませんでした。')
    } catch {
      setReconcileNotice('確認できませんでした。時間を置いてお試しください。')
    } finally {
      setReconciling(false)
    }
  }

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
  // 買い切りは枚数の少ない順に。まとめるほど安くなることが並びで分かるようにする
  const topupPlans = plans.filter((p) => p.kind === 'one_time').sort((a, b) => a.credits - b.credits)
  // いちばん割高なものを基準に、どれだけ得かを出す
  const topupBaseRate = topupPlans.length > 0 ? Math.max(...topupPlans.map(unitPrice)) : 0
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
            {/* 内訳は畳んでパネルへ。残高の面に細かい表を常時置くと、
                いちばん見たい数字（残り何cr）が埋もれる */}
            <div className="flex flex-wrap items-center gap-2">
              <CreditBreakdownButton />
              {summary?.credit_buckets && summary.credit_buckets.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {summary.credit_buckets.length} 種類・期限が近いものから使われます
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReconcile}
                disabled={reconciling}
                className="flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={reconciling ? 'animate-spin' : undefined} />
                支払いを反映する
              </Button>
              {reconcileNotice && <span className="text-sm text-muted-foreground">{reconcileNotice}</span>}
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">いまの位</dt>
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

          {/* 受け取ったコードの行き先。残高のすぐ下に置く */}
          <RedeemCodePanel onRedeemed={() => useBillingStore.getState().fetchSummary()} />

          <AiUsagePanel />

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
              {/* 位＝市民・書記官…と呼ぶので、見出しも合わせる。
                  「プラン」と「市民」が並ぶと、どちらが呼び名なのか分からない */}
              <h2 className="text-lg font-semibold">位を選ぶ</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {subscriptionPlans.map((plan) => {
                const isCurrent = plan.tier === currentTier
                const busy = busyPlan === plan.name
                return (
                  <div key={plan.name} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                    <div>
                      <p className="flex items-center gap-2 text-base font-semibold">
                        {plan.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={plan.image_url} alt="" width={28} height={28} loading="lazy" />
                        )}
                        {tierLabel(plan.tier)}
                      </p>
                      {/* 呼び名だけでは何の位か分からない。一言だけ添える */}
                      {TIER_NOTES[plan.tier] && (
                        <p className="text-xs text-muted-foreground">{TIER_NOTES[plan.tier]}</p>
                      )}
                      <p className="mt-1 text-2xl font-bold">
                        {formatYen(plan.price)}
                        <span className="text-sm font-normal text-muted-foreground"> / 月</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        月 {plan.credits.toLocaleString('ja-JP')} クレジット
                      </p>
                      {/* 期限を書かないと「貯まり続ける」と読まれる。
                          実際は更新のたびに前月分が失効して入れ替わる（買い切り分は別で繰り越す） */}
                      <p className="text-xs text-muted-foreground">
                        毎月入れ替わります（前月分は繰り越しません）
                      </p>
                    </div>
                    <Button
                      onClick={() => handleCheckout(plan.name)}
                      disabled={isCurrent || busy}
                      variant={isCurrent ? 'outline' : 'default'}
                      className="mt-auto"
                    >
                      {isCurrent ? 'いまの位' : busy ? '移動中…' : 'この位にする'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>

          {summary?.subscription && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">位の変更・解約</h2>
              <p className="text-sm text-muted-foreground">
                位の変更・解約、契約ステータスの確認は、お支払い管理ページ（Stripe）から行えます。
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
              <p className="text-sm text-muted-foreground">
                まとめるほど1枚あたりが安くなります。クレジットは受け取ってから6ヶ月間有効です。
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topupPlans.map((plan) => {
                  const discount = discountPercent(unitPrice(plan), topupBaseRate)
                  return (
                    <button
                      key={plan.name}
                      type="button"
                      onClick={() => handleCheckout(plan.name)}
                      disabled={busyPlan === plan.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Coins size={15} style={{ color: 'var(--palace)' }} />
                          {plan.credits.toLocaleString('ja-JP')} クレジット
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          1枚あたり {formatYen(Math.round(unitPrice(plan) * 10) / 10)}
                          {discount > 0 && <span className="ml-1 text-[var(--palace)]">{discount}% お得</span>}
                        </span>
                        {/* 買い切りは繰り越すが無期限ではない。期限を出さないと、
                            ある日いきなり減ったように見える */}
                        <span className="block text-xs text-muted-foreground">{TOPUP_VALIDITY}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold">{formatYen(plan.price)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <CreditHistoryPanel />
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
                有料の位を契約すると、お支払い管理ページが使えます。
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
      <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <CreditCard size={26} style={{ color: 'var(--palace)' }} />
          利用と支払い
        </h1>
        <p className="mt-2 text-muted-foreground">
          クレジット残高の確認、プランのアップグレード、クレジットの追加ができます。
        </p>
      </div>

      {checkoutNotice === 'success' && (
        <p className="rounded-lg border border-[var(--palace)]/40 bg-[rgba(198,167,94,0.08)] px-4 py-3 text-sm">
          {applyState === 'applied' ? (
            <>決済が完了し、{summary?.plan?.name ?? '新しいプラン'}が有効になりました。</>
          ) : applyState === 'slow' ? (
            <>
              決済は完了しています。プランの反映に時間がかかっているようです。
              しばらくしてから画面を再読み込みしてください。
            </>
          ) : (
            <>決済が完了しました。プランの反映を確認しています…（数秒かかる場合があります）</>
          )}
        </p>
      )}
      {checkoutNotice === 'cancel' && (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          決済はキャンセルされました。
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <CategorySections sections={sections} ariaLabel="利用と支払いカテゴリ" />

      {/* 残高の内訳。開くのは上のボタンから */}
      <CreditBreakdownPanel />
      </div>
    </div>
  )
}
