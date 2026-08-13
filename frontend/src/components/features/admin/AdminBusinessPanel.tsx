'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { PeriodSelect } from './PeriodSelect'
import { HelpPopover } from '@/components/ui/help-popover'
import { getAdminBusinessMetrics } from '@/lib/api/admin'
import { metricDefinition, metricLabel, type MetricKey } from '@/lib/admin/metric-glossary'
import { deltaRate, type MetricDelta } from '@/lib/metrics'
import type { AdminBusinessMetrics } from '@/types/admin'

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`
const num = (value: number) => value.toLocaleString()
const pct = (value: number) => `${value}%`
const cr = (value: number) => `${value.toLocaleString()} cr`

/**
 * 経営の数字。
 *
 * 運営ダッシュボード（概要）が「いま何が動いているか」を見るのに対し、
 * ここは「商売として伸びているか」を見る。
 *
 * **数字の出せなさを3つに分ける。**
 *   未計測 …… まだ測っていない（記録そのものが無い）
 *   算出不可 … 記録はあるが、割り算の分母が0で出せない
 *   参考値 …… 出せるが、母数が小さい・期間が満ちていないので鵜呑みにできない
 * どれも 0 とは違う。混ぜると、起きていないのか測れていないのかが読めなくなる。
 */
export function AdminBusinessPanel() {
  const [data, setData] = useState<AdminBusinessMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('')

  useEffect(() => {
    let cancelled = false
    getAdminBusinessMetrics(period ? { period } : undefined)
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch(() => {
        if (!cancelled) setError('数字を読み込めませんでした')
      })
    return () => {
      cancelled = true
    }
  }, [period])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        読み込んでいます
      </div>
    )
  }

  const {
    active,
    engagement,
    users,
    revenue,
    retention,
    unit_economics: unit,
    credit_economics: credits,
    activity_retention: retentionDays,
  } = data
  const measuredAt = new Date(data.generated_at)
  const measuredSince = data.measurement.last_seen_since
    ? new Date(data.measurement.last_seen_since)
    : null

  /**
   * その窓（日数）を満たすだけ測れているか。
   *
   * 計測を3日前に始めたのに30日の窓を見れば、数字は「30日ぶん」ではない。
   * 満ちていない窓は参考値として出す。多いか少ないかを判断できる数字ではない。
   */
  const windowFilled = (days: number) => {
    if (!measuredSince) return false
    // いまの時刻ではなく、サーバーが数えた時刻を基準にする。
    // 画面が再描画されるたびに答えが変わらないようにするため
    const elapsedDays = (measuredAt.getTime() - measuredSince.getTime()) / 86_400_000
    return elapsedDays >= days
  }
  const sinceNote = measuredSince
    ? `計測開始 ${measuredSince.toLocaleDateString('ja-JP')}`
    : undefined
  const activeNote = (days: number) => (windowFilled(days) ? undefined : sinceNote)

  return (
    <div className="space-y-8">
      <PeriodSelect period={data.period} value={period || data.period.key} onChange={setPeriod} />

      <MeasurementNotice measurement={data.measurement} testRevenue={revenue.test_revenue_jpy} />

      {/*
        いちばん上に、状態を掴むための数字だけを置く。
        下の各節は「なぜそうなっているか」を見る場所で、ここは「いまどうか」を見る場所。
        増やすと10秒で読めなくなるので、6枚に絞る。
      */}
      <Section title="ビジネスの状態" note="まずここだけ見れば、いまの調子が分かる">
        <MetricCard metric="mrr" value={yen(revenue.mrr_jpy)} />
        <MetricCard metric="grossProfit" value={yen(unit.gross_profit_jpy)} />
        <MetricCard
          metric="grossMargin"
          value={unit.gross_margin === null ? null : pct(unit.gross_margin)}
          empty="unavailable"
          emptyReason="売上が 0 円のときは割り算ができない"
        />
        <MetricCard
          metric="mau"
          value={active.mau === null ? null : num(active.mau)}
          reference={active.mau !== null && !windowFilled(30)}
          sub={activeNote(30)}
        />
        <MetricCard metric="payingUsers" value={num(users.paying)} />
        <MetricCard
          metric="aiCost"
          value={yen(unit.ai_cost_jpy)}
          sub={
            credits.cost_per_credit_jpy === null
              ? undefined
              : `1枚あたり ${yen(credits.cost_per_credit_jpy)}`
          }
        />
      </Section>

      <Section
        title="来た人（Active）"
        note="来訪の記録から数える。手を動かしたかどうかは見ない"
      >
        <MetricCard
          metric="dau"
          value={active.dau === null ? null : num(active.dau)}
          reference={active.dau !== null && !windowFilled(1)}
          sub={activeNote(1)}
        />
        <MetricCard
          metric="wau"
          value={active.wau === null ? null : num(active.wau)}
          reference={active.wau !== null && !windowFilled(7)}
          sub={activeNote(7)}
        />
        <MetricCard
          metric="mau"
          value={active.mau === null ? null : num(active.mau)}
          reference={active.mau !== null && !windowFilled(30)}
          sub={activeNote(30)}
        />
        <MetricCard
          metric="stickiness"
          value={active.stickiness === null ? null : pct(active.stickiness)}
          empty="unavailable"
          emptyReason="MAU が 0 のときは割り算ができない"
          // 母数が小さいうちは 1 人の増減で 0% にも 100% にもなる
          reference={active.mau !== null && active.mau < 10}
          sub={active.mau === null ? undefined : `母数 MAU ${num(active.mau)}人`}
        />
      </Section>

      <Section
        title="使った人（Engagement）"
        note="実際の行動から数える。前の期間と同じ長さで並べている"
      >
        <MetricCard
          metric="cardsCreated"
          value={num(engagement.current.cards_created)}
          delta={deltaRate(engagement.current.cards_created, engagement.previous.cards_created)}
        />
        <MetricCard
          metric="imagesGenerated"
          value={num(engagement.current.images_generated)}
          delta={deltaRate(engagement.current.images_generated, engagement.previous.images_generated)}
        />
        <MetricCard
          metric="reviews"
          value={num(engagement.current.reviews)}
          delta={deltaRate(engagement.current.reviews, engagement.previous.reviews)}
        />
        <MetricCard
          metric="actingUsers"
          value={num(engagement.current.acting_users)}
          delta={deltaRate(engagement.current.acting_users, engagement.previous.acting_users)}
          sub={
            engagement.actions_per_acting_user === null
              ? undefined
              : `1人あたり ${engagement.actions_per_acting_user} 行動`
          }
        />
      </Section>

      <Section title="利用者と転換" note="登録から有料までの流れ">
        <MetricCard metric="totalUsers" value={num(users.total)} />
        <MetricCard
          metric="newUsers"
          value={num(users.new_in_period)}
          delta={deltaRate(users.new_in_period, users.new_in_previous)}
        />
        <MetricCard metric="payingUsers" value={num(users.paying)} />
        <MetricCard
          metric="freeToPaidCvr"
          value={users.free_to_paid_cvr === null ? null : pct(users.free_to_paid_cvr)}
          empty="unavailable"
          emptyReason="登録者が 0 人のときは割り算ができない"
          reference={users.total < 30}
          sub={`母数 ${num(users.total)}人`}
        />
      </Section>

      <Section title="売上" note="テストの決済は本物と分けている">
        <MetricCard
          metric="revenue"
          value={yen(revenue.total_jpy)}
          delta={deltaRate(revenue.total_jpy, revenue.previous_total_jpy)}
        />
        <MetricCard metric="mrr" value={yen(revenue.mrr_jpy)} />
        <MetricCard metric="arr" value={yen(revenue.arr_jpy)} />
        <MetricCard
          metric="arpu"
          value={revenue.arpu_jpy === null ? null : yen(revenue.arpu_jpy)}
          empty="unavailable"
          emptyReason="登録者が 0 人のときは割り算ができない"
        />
        <MetricCard
          metric="arppu"
          value={revenue.arppu_jpy === null ? null : yen(revenue.arppu_jpy)}
          empty="unavailable"
          emptyReason="支払っている人が 0 人のときは割り算ができない"
        />
      </Section>

      <Section title="継続と単位経済" note="続くかどうかと、1人あたりの採算">
        <MetricCard
          metric="churn"
          value={retention.churn_rate === null ? null : pct(retention.churn_rate)}
          empty="unavailable"
          emptyReason={retention.note ?? '期間の初めに有料契約が無いと出せない'}
        />
        <MetricCard
          metric="aiCost"
          value={yen(unit.ai_cost_jpy)}
          sub={
            unit.ai_cost_per_user_jpy === null
              ? undefined
              : `1人あたり ${yen(unit.ai_cost_per_user_jpy)}`
          }
        />
        <MetricCard metric="grossProfit" value={yen(unit.gross_profit_jpy)} />
        <MetricCard
          metric="grossMargin"
          value={unit.gross_margin === null ? null : pct(unit.gross_margin)}
          empty="unavailable"
          emptyReason="売上が 0 円のときは割り算ができない"
        />
        <MetricCard
          metric="ltv"
          value={unit.ltv.value_jpy === null ? null : yen(unit.ltv.value_jpy)}
          empty="unavailable"
          emptyReason={unit.ltv.basis}
          reference={unit.ltv.reference}
          sub={unit.ltv.value_jpy === null ? undefined : unit.ltv.basis}
        />
      </Section>

      <Section
        title="続けて使われているか"
        note={
          retentionDays.measurement_started_on
            ? `計測開始 ${new Date(retentionDays.measurement_started_on).toLocaleDateString('ja-JP')}。それより前の来訪は残っていない`
            : undefined
        }
      >
        {(['d1', 'd7', 'd30'] as const).map((key) => {
          const day = retentionDays.days[key]
          return (
            <MetricCard
              key={key}
              metric={key === 'd1' ? 'retentionD1' : key === 'd7' ? 'retentionD7' : 'retentionD30'}
              value={day.rate === null ? null : pct(day.rate)}
              empty="not-measured"
              emptyReason={
                day.mature ? '答えの出せる人がいない' : '計測中（この日数が経った人がまだいない）'
              }
              // 母数が小さいうちは1人で大きく動く
              reference={day.mature && day.cohort < 10}
              sub={day.mature ? `母数 ${num(day.cohort)}人・戻った ${num(day.returned ?? 0)}人` : undefined}
            />
          )
        })}
      </Section>

      <Section title="クレジット経済" note="配った量・使われた量・まだ提供していない量">
        <MetricCard metric="creditsIssued" value={cr(credits.issued)} />
        <MetricCard
          metric="creditsConsumed"
          value={cr(credits.consumed)}
          sub={
            credits.consumption_to_issuance === null
              ? undefined
              : `配ったぶんの ${pct(credits.consumption_to_issuance)}（同じ枚の追跡ではない）`
          }
        />
        <MetricCard metric="creditsExpired" value={cr(credits.expired)} />
        <MetricCard
          metric="creditsOutstanding"
          value={cr(credits.outstanding)}
          sub={`無料 ${cr(credits.outstanding_free)} / 有料 ${cr(credits.outstanding_paid)}`}
        />
        <MetricCard
          metric="creditUnitCost"
          value={credits.cost_per_credit_jpy === null ? null : yen(credits.cost_per_credit_jpy)}
          empty="unavailable"
          emptyReason="この期間に使われたクレジットが 0 枚"
          sub={
            credits.estimated_unfulfilled_cost_jpy === null
              ? undefined
              : `未使用ぶんの原価の見当 ${yen(credits.estimated_unfulfilled_cost_jpy)}`
          }
        />
        <MetricCard
          metric="creditsExpiringSoon"
          value={cr(credits.expiring.within_30_days)}
          sub={
            credits.expiring.share_of_outstanding === null
              ? `7日以内 ${cr(credits.expiring.within_7_days)}`
              : `未使用の ${pct(credits.expiring.share_of_outstanding)}・7日以内 ${cr(credits.expiring.within_7_days)}`
          }
        />
      </Section>

      <CostBreakdown breakdown={unit.cost_breakdown} grossProfit={unit.gross_profit_jpy} />
    </div>
  )
}

/**
 * 粗利の内訳。
 *
 * 「AI 原価は ¥1,236 なのに粗利は -¥13,276」の差が何なのか、
 * カードだけを見ても分からなかった。**引き算をそのまま並べて、画面の上で閉じさせる。**
 */
function CostBreakdown({
  breakdown,
  grossProfit,
}: {
  breakdown: AdminBusinessMetrics['unit_economics']['cost_breakdown']
  grossProfit: number
}) {
  const rows = [
    { label: '決済手数料', value: breakdown.stripe_fee_jpy, note: '売上に対する Stripe の手数料' },
    { label: '画像の原価', value: breakdown.image_jpy, note: '生成回数 × 単価 × 為替' },
    { label: '文章の原価', value: breakdown.text_jpy, note: 'トークン数 × 単価 × 為替' },
    {
      label: 'インフラ費（期間配賦）',
      value: breakdown.infra_jpy,
      note: `月額の見積りを日数で配ったぶん（この期間で約${breakdown.infra_months}か月ぶん）`,
    },
  ]

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">原価の内訳</h2>
        <p className="text-xs text-muted-foreground">粗利がその額になる理由</p>
        <HelpPopover label="原価の内訳について" title="原価の内訳｜インフラ費の配り方">
          <dl className="space-y-2">
            <HelpRow
              term="インフラ費（期間配賦）"
              description="月額の固定費を、選んだ期間の日数ぶんに配った額。月額 → 年額 → 日額 → 期間ぶん、と配る。"
            />
            <HelpRow
              term="請求額ではない"
              description="実際の請求日・請求額そのものではない。期間を比べて粗利を掴むための管理上の数字。"
            />
            <HelpRow
              term="なぜ配るか"
              description="またいだ月の数で数えると、同じ30日でも月の変わり目をまたぐだけで2ヶ月ぶんが乗り、期間どうしを比べられなくなる。"
            />
            <HelpRow
              term="月次の収支は別"
              description="収支ページ（年月で見る面）は按分せず、その月ぶんをそのまま乗せる。請求と読み比べるための面のため。"
            />
          </dl>
        </HelpPopover>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full min-w-[28rem] text-sm">
          <tbody className="divide-y divide-border">
            <tr>
              <th scope="row" className="px-4 py-2.5 text-left font-medium">
                売上
              </th>
              <td className="px-4 py-2.5 text-right tabular-nums">{yen(breakdown.revenue_jpy)}</td>
              <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                本番の決済のみ
              </td>
            </tr>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-2.5 pl-8 text-left font-normal text-muted-foreground">
                  − {row.label}
                </th>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {yen(row.value)}
                </td>
                <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                  {row.note}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30">
              <th scope="row" className="px-4 py-2.5 text-left font-medium">
                原価の合計
              </th>
              <td className="px-4 py-2.5 text-right tabular-nums">{yen(breakdown.total_jpy)}</td>
              <td className="hidden px-4 py-2.5 sm:table-cell" />
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 text-left font-semibold">
                粗利
              </th>
              <td
                className={`px-4 py-3 text-right text-base font-semibold tabular-nums ${
                  grossProfit < 0 ? 'text-rose-600 dark:text-rose-500' : ''
                }`}
              >
                {yen(grossProfit)}
              </td>
              <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                売上 − 原価の合計
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        インフラは使われていなくても出ていくため、売上が 0 円でも粗利はその額ぶん赤字になる。
        単価と月額は収支ページで設定する。
      </p>
    </section>
  )
}

function MeasurementNotice({
  measurement,
  testRevenue,
}: {
  measurement: AdminBusinessMetrics['measurement']
  testRevenue: number
}) {
  const notices: string[] = []

  if (!measurement.last_seen_since) {
    notices.push('来訪の記録はまだ始まっていない（Active の数字は出せない）')
  } else if (measurement.last_seen_partial) {
    notices.push(
      `来訪の記録は ${new Date(measurement.last_seen_since).toLocaleDateString('ja-JP')} から。` +
        'それより前は測っていないため、この期間の Active は途中からの数字になる'
    )
  }

  notices.push('DAU / WAU / MAU は前の期間と比べられない（最後に来た日しか持たないため）')

  if (testRevenue !== 0) {
    notices.push(`テストの決済 ${yen(testRevenue)} は売上に含めていない`)
  }

  return (
    <ul className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      {notices.map((notice) => (
        <li key={notice}>・{notice}</li>
      ))}
    </ul>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

/**
 * 指標1つ。説明は用語集（metric-glossary）から引く。
 *
 * 値が null のときは「未計測」か「算出不可」と出す。**空欄や 0 にしない。**
 * 出せていないカードは少し弱く見せる。読むべき数字と並んで同じ強さで居座らせない。
 */
function MetricCard({
  metric,
  value,
  delta: change,
  sub,
  reference,
  empty = 'not-measured',
  emptyReason,
}: {
  metric: MetricKey
  value: string | null
  delta?: MetricDelta | null
  sub?: string
  reference?: boolean
  /** 値が無いときの言い方。測っていないのか、割り算ができないのか */
  empty?: 'not-measured' | 'unavailable'
  emptyReason?: string
}) {
  const definition = metricDefinition(metric)
  const missing = value === null

  return (
    <div
      className={`rounded-xl border bg-background p-4 ${
        missing ? 'border-border/60 opacity-70' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{definition.name}</p>
          <p className="text-[11px] tracking-wide text-muted-foreground/70">
            {metricLabel(metric)}
          </p>
        </div>
        <HelpPopover
          label={`${definition.name}について`}
          title={`${definition.abbr}｜${definition.fullName}`}
        >
          <dl className="space-y-2">
            {definition.reading && <HelpRow term="読み方" description={definition.reading} />}
            <HelpRow term="意味" description={definition.meaning} />
            <HelpRow term="計算" description={definition.formula} />
            <HelpRow term="なぜ見るか" description={definition.why} />
            <HelpRow term="ImagePalace では" description={definition.here} />
          </dl>
        </HelpPopover>
      </div>

      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {missing ? (
          <span className="text-base text-muted-foreground">
            {empty === 'unavailable' ? '算出不可' : '未計測'}
          </span>
        ) : (
          value
        )}
      </p>

      <div className="mt-1 space-y-0.5">
        {missing && emptyReason && (
          <p className="text-[11px] text-muted-foreground">{emptyReason}</p>
        )}
        {!missing && reference && (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">参考値</p>
        )}
        {change && (
          <p
            className={`flex items-center gap-1 text-xs ${
              change.up ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
            }`}
          >
            {change.up ? (
              <TrendingUp className="size-3.5" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden />
            )}
            前の期間より {change.up ? '+' : ''}
            {change.rate}%
          </p>
        )}
        {!missing && sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function HelpRow({ term, description }: { term: string; description: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{term}</dt>
      <dd className="text-sm">{description}</dd>
    </div>
  )
}
