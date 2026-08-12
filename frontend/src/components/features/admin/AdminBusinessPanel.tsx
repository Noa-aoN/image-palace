'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { PeriodSelect } from './PeriodSelect'
import { HelpPopover } from '@/components/ui/help-popover'
import { getAdminBusinessMetrics } from '@/lib/api/admin'
import { deltaRate, type MetricDelta } from '@/lib/metrics'
import type { AdminBusinessMetrics } from '@/types/admin'

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`
const num = (value: number) => value.toLocaleString()
const pct = (value: number) => `${value}%`

/**
 * 経営の数字。
 *
 * 運営ダッシュボード（概要）が「いま何が動いているか」を見るのに対し、
 * ここは「商売として伸びているか」を見る。
 *
 * **出せない数字は空欄にせず「未計測」と書く。** 0 と混ざると、
 * 起きていないのか測れていないのかが読めなくなる。
 * 母数が小さくて参考にしかならないものは、その旨をカードに出す。
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

  const { active, engagement, users, revenue, retention, unit_economics: unit } = data

  return (
    <div className="space-y-8">
      <PeriodSelect period={data.period} value={period || data.period.key} onChange={setPeriod} />

      <MeasurementNotice measurement={data.measurement} testRevenue={revenue.test_revenue_jpy} />

      <Section
        title="来た人（Active）"
        note="来訪の記録から数える。手を動かしたかどうかは見ない"
      >
        <MetricCard
          name="1日あたりの利用者"
          abbr="DAU"
          value={active.dau === null ? null : num(active.dau)}
          help={{
            fullName: 'Daily Active Users',
            meaning: '直近24時間のうちに来た人の数。',
            formula: 'users.last_seen_at が直近24時間に入る人を数える。',
            why: '毎日使われているかは、続けて使えているかの一番素直な現れ。',
            here: 'ImagePalace では「来た」だけを数える。カードを作ったかは Engagement で別に見る。',
          }}
        />
        <MetricCard
          name="1週間あたりの利用者"
          abbr="WAU"
          value={active.wau === null ? null : num(active.wau)}
          help={{
            fullName: 'Weekly Active Users',
            meaning: '直近7日のうちに来た人の数。',
            formula: 'users.last_seen_at が直近7日に入る人を数える。',
            why: '毎日ではなくても週に一度は戻ってくるか、という粒度で見られる。',
            here: '学習は毎日とは限らないので、DAU より実態に近いことが多い。',
          }}
        />
        <MetricCard
          name="1か月あたりの利用者"
          abbr="MAU"
          value={active.mau === null ? null : num(active.mau)}
          help={{
            fullName: 'Monthly Active Users',
            meaning: '直近30日のうちに来た人の数。',
            formula: 'users.last_seen_at が直近30日に入る人を数える。',
            why: 'サービスの大きさを表す基本の数。多くの指標の母数にもなる。',
            here: '無料枠の周期（登録日から1か月ごと）と読み比べられるよう30日にしている。',
          }}
        />
        <MetricCard
          name="粘着度"
          abbr="DAU/MAU"
          value={active.stickiness === null ? null : pct(active.stickiness)}
          help={{
            fullName: 'Stickiness',
            meaning: '月に来る人のうち、どれくらいが毎日来ているか。',
            formula: 'DAU ÷ MAU × 100',
            why: '習慣になっているかを見る。数が小さくても割合は意味を持つ。',
            here: '暗記は毎日やるほど効く。ここが上がるほど、道具として定着している。',
          }}
        />
      </Section>

      <Section
        title="使った人（Engagement）"
        note="実際の行動から数える。前の期間と同じ長さで並べている"
      >
        <MetricCard
          name="作られたカード"
          abbr="Cards"
          value={num(engagement.current.cards_created)}
          delta={deltaRate(engagement.current.cards_created, engagement.previous.cards_created)}
          help={{
            fullName: 'Cards Created',
            meaning: '期間内に作られたカードの数。',
            formula: 'items の作成日時が期間内のものを数える。',
            why: 'ImagePalace で最初に起きる価値ある行動。',
            here: 'ここが動かないと、画像生成もクレジット消費も起きない。',
          }}
        />
        <MetricCard
          name="生成された画像"
          abbr="Images"
          value={num(engagement.current.images_generated)}
          delta={deltaRate(engagement.current.images_generated, engagement.previous.images_generated)}
          help={{
            fullName: 'Images Generated',
            meaning: '期間内の画像生成の回数（キャッシュで済んだぶんも含む）。',
            formula: 'image_usages の作成日時が期間内のものを数える。',
            why: '原価が発生する行動そのもの。売上と並べて見る。',
            here: 'キャッシュが効いたぶんは API を呼んでいないので、原価には数えていない。',
          }}
        />
        <MetricCard
          name="復習"
          abbr="Reviews"
          value={num(engagement.current.reviews)}
          delta={deltaRate(engagement.current.reviews, engagement.previous.reviews)}
          help={{
            fullName: 'Reviews',
            meaning: '期間内に復習された回数。',
            formula: 'item_reviews の復習日時が期間内のものを数える。',
            why: '作って終わりではなく、学習に使われているかが分かる。',
            here: '記憶の定着がサービスの目的なので、作成数より重い意味を持つ。',
          }}
        />
        <MetricCard
          name="手を動かした人"
          abbr="Acting Users"
          value={num(engagement.current.acting_users)}
          delta={deltaRate(engagement.current.acting_users, engagement.previous.acting_users)}
          sub={
            engagement.actions_per_acting_user === null
              ? undefined
              : `1人あたり ${engagement.actions_per_acting_user} 行動`
          }
          help={{
            fullName: 'Acting Users',
            meaning: 'カード作成・画像生成・復習・クレジット消費のどれかをした人の数。',
            formula: '4つの記録の user_id を重複を除いて数える。',
            why: '「来た」と「使った」は別のこと。使った人だけを見る。',
            here: 'Active（来た人）との差が、見に来ただけの人の数になる。',
          }}
        />
      </Section>

      <Section title="利用者と転換" note="登録から有料までの流れ">
        <MetricCard
          name="登録者数"
          abbr="Total Users"
          value={num(users.total)}
          help={{
            fullName: 'Total Users',
            meaning: 'いま登録されている人の総数。',
            formula: 'users の全件。',
            why: '多くの割合の母数になる。',
            here: '退会した人は行ごと消えるため、ここには残らない。',
          }}
        />
        <MetricCard
          name="新規登録"
          abbr="New Users"
          value={num(users.new_in_period)}
          delta={deltaRate(users.new_in_period, users.new_in_previous)}
          help={{
            fullName: 'New Users',
            meaning: '期間内に登録した人の数。',
            formula: 'users の登録日時が期間内のものを数える。',
            why: '入口がどれだけ広がっているかを見る。',
            here: '広告を出していないので、いまは口コミと検索の結果がそのまま出る。',
          }}
        />
        <MetricCard
          name="支払っている人"
          abbr="Paying Users"
          value={num(users.paying)}
          help={{
            fullName: 'Paying Users',
            meaning: 'いま有料契約が有効な人の数。',
            formula: 'status が active かつ本番（livemode）の契約を持つ人を重複を除いて数える。',
            why: '売上の source。ここが増えないかぎり MRR は伸びない。',
            here: 'お試し中（trialing）はまだ入金が無いので数に入れない。テスト契約も混ぜない。',
          }}
        />
        <MetricCard
          name="有料への転換率"
          abbr="Free→Paid CVR"
          value={users.free_to_paid_cvr === null ? null : pct(users.free_to_paid_cvr)}
          help={{
            fullName: 'Free to Paid Conversion Rate',
            meaning: '登録した人のうち、有料に至った割合。',
            formula: '支払っている人 ÷ 登録者数 × 100（期間で切らない累積）',
            why: '無料で使ってもらう設計が、商売として成立するかを決める。',
            here: '母数が小さいうちは1人の増減で大きく動く。傾向として見る。',
          }}
        />
      </Section>

      <Section title="売上" note="テストの決済は本物と分けている">
        <MetricCard
          name="売上"
          abbr="Revenue"
          value={yen(revenue.total_jpy)}
          delta={deltaRate(revenue.total_jpy, revenue.previous_total_jpy)}
          help={{
            fullName: 'Revenue',
            meaning: '期間内に入った額（サブスクと買い切りの合計）。',
            formula: 'credit_transactions の金額のうち、本番（livemode）のものを合計する。',
            why: '説明の要らない、いちばん確かな数字。',
            here: '収支ページと同じ計算を使っている。テストの決済は別に出す。',
          }}
        />
        <MetricCard
          name="毎月入る額"
          abbr="MRR"
          value={yen(revenue.mrr_jpy)}
          help={{
            fullName: 'Monthly Recurring Revenue',
            meaning: '契約が続くかぎり毎月入ってくる額。',
            formula: '有効な有料契約のプラン価格を合計する。',
            why: '一度きりの売上と違い、来月も入る見込みとして数えられる。',
            here: '買い切り（Top-up）は含めない。翌月も入る保証が無いため。',
          }}
        />
        <MetricCard
          name="年換算の額"
          abbr="ARR"
          value={yen(revenue.arr_jpy)}
          help={{
            fullName: 'Annual Recurring Revenue',
            meaning: 'いまの MRR が1年続いた場合の額。',
            formula: 'MRR × 12',
            why: '事業の規模を年単位で表す共通語。',
            here: 'あくまで「いまの状態が続けば」の数字で、実績ではない。',
          }}
        />
        <MetricCard
          name="1人あたりの売上"
          abbr="ARPU"
          value={revenue.arpu_jpy === null ? null : yen(revenue.arpu_jpy)}
          help={{
            fullName: 'Average Revenue Per User',
            meaning: '登録者1人あたりの売上。',
            formula: '期間の売上 ÷ 登録者数',
            why: '人を増やす価値がいくらかを表す。',
            here: '無料の人も母数に入る。有料の人だけを見たいときは ARPPU を使う。',
          }}
        />
        <MetricCard
          name="有料1人あたりの売上"
          abbr="ARPPU"
          value={revenue.arppu_jpy === null ? null : yen(revenue.arppu_jpy)}
          help={{
            fullName: 'Average Revenue Per Paying User',
            meaning: '支払っている人1人あたりの売上。',
            formula: '期間の売上 ÷ 支払っている人の数',
            why: '価格設計が効いているかを見る。LTV の土台にもなる。',
            here: '支払っている人が0人のときは割り算ができないので「未計測」と出す。',
          }}
        />
      </Section>

      <Section title="継続と単位経済" note="続くかどうかと、1人あたりの採算">
        <MetricCard
          name="解約率"
          abbr="Churn"
          value={retention.churn_rate === null ? null : pct(retention.churn_rate)}
          sub={retention.note ?? undefined}
          help={{
            fullName: 'Churn Rate',
            meaning: '期間の初めにいた契約者のうち、期間内に解約した割合。',
            formula: '期間内の解約数 ÷ 期間の初めの契約数 × 100',
            why: '入口をいくら広げても、ここが大きいと積み上がらない。',
            here: '期間の初めに契約が無いときは率を出さない。0% と書くと、解約が無いのか契約が無いのかが読めないため。',
          }}
        />
        <MetricCard
          name="AI の原価"
          abbr="AI Cost"
          value={yen(unit.ai_cost_jpy)}
          sub={
            unit.ai_cost_per_user_jpy === null
              ? undefined
              : `1人あたり ${yen(unit.ai_cost_per_user_jpy)}`
          }
          help={{
            fullName: 'AI Cost',
            meaning: '画像生成と文章生成にかかった費用の見積り。',
            formula: '実際の呼び出し回数 × 単価（為替を掛ける）。単価は収支ページで設定する。',
            why: 'ここが売上を超えると、使われるほど損をする。',
            here: '回数は正確（image_usages / ai_usages）だが、単価は設定値なのでそこが誤差になる。',
          }}
        />
        <MetricCard
          name="粗利"
          abbr="Gross Profit"
          value={yen(unit.gross_profit_jpy)}
          sub={unit.gross_margin === null ? undefined : `粗利率 ${pct(unit.gross_margin)}`}
          help={{
            fullName: 'Gross Profit',
            meaning: '売上から、売るために直接かかった費用を引いた額。',
            formula: '売上 −（決済手数料 + 画像原価 + 文章原価 + インフラ）',
            why: '事業として成り立つかを決める。売上だけでは分からない。',
            here: '収支ページと同じ計算を使っている。人件費は含めていない。',
          }}
        />
        <MetricCard
          name="顧客生涯価値"
          abbr="LTV"
          value={unit.ltv.value_jpy === null ? null : yen(unit.ltv.value_jpy)}
          reference={unit.ltv.reference}
          sub={unit.ltv.basis}
          help={{
            fullName: 'Lifetime Value',
            meaning: '1人の利用者が、使い続ける間にもたらす売上の合計。',
            formula: 'ARPPU × 平均継続月数',
            why: '獲得にいくらまで使えるかを決める基準になる（CAC と比べて使う）。',
            here: '解約がまだ起きていないため、平均継続月数は契約開始からの経過月数で代用している。母数も小さく、参考値としてしか使えない。',
          }}
        />
      </Section>
    </div>
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
 * 指標1つ。
 *
 * 値が null のときは「未計測」と出す。**空欄や 0 にしない。**
 * 参考値のものは、そうと分かるようにしてから数字を見せる。
 */
function MetricCard({
  name,
  abbr,
  value,
  delta: change,
  sub,
  reference,
  help,
}: {
  name: string
  abbr: string
  value: string | null
  delta?: MetricDelta | null
  sub?: string
  reference?: boolean
  help: {
    fullName: string
    meaning: string
    formula: string
    why: string
    here: string
  }
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{name}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{abbr}</p>
        </div>
        <HelpPopover label={`${name}について`} title={`${abbr}｜${help.fullName}`}>
          <dl className="space-y-2">
            <HelpRow term="意味" description={help.meaning} />
            <HelpRow term="計算" description={help.formula} />
            <HelpRow term="なぜ見るか" description={help.why} />
            <HelpRow term="ImagePalace では" description={help.here} />
          </dl>
        </HelpPopover>
      </div>

      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {value === null ? <span className="text-base text-muted-foreground">未計測</span> : value}
      </p>

      <div className="mt-1 space-y-0.5">
        {reference && <p className="text-[11px] text-amber-600 dark:text-amber-500">参考値</p>}
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
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
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
