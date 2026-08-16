// 課金関連の型（バックエンド /api/v1/billing/* のレスポンスに対応）

export type BillingPlan = {
  name: string
  tier: string
  kind: 'subscription' | 'one_time'
  interval: string | null
  price: number // JPY は最小単位＝円
  currency: string
  credits: number
  /** プランの徽章。用意していなければ null */
  image_url?: string | null
}

export type BillingSummary = {
  available_credits: number
  // 残高の内訳（クレジット単位）。grant=期限付きボーナス（最も近い期限）。
  credit_breakdown?: {
    grant: number
    grant_expires_at: string | null
    subscription: number
    topup: number
  }
  plan: { name: string; tier: string; credits_per_period: number } | null
  subscription: {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  // 次回のクレジット更新（回復）日。無料会員でも返る（翌月初）。
  next_credit_reset: string | null
  /** 残高の内訳を「いつ消えるか」で並べたもの。期限が近い順＝使われる順 */
  credit_buckets?: CreditBucket[]
}

export interface CreditBucket {
  kind: string
  label: string
  credits: number
  /** null は期限なし */
  expires_at: string | null
  /** 受け取った日。まとめて持っている残高（サブスク・古い買い切り）は決まらないので null */
  granted_at?: string | null
}

// 使用量（AIの利用・クレジットの消費・カードの作成）。バックエンド /api/v1/billing/ai_usage に対応。

export type UsagePeriod = 'month' | '30d' | '90d'

export const USAGE_PERIODS: Record<UsagePeriod, string> = {
  month: '今月',
  '30d': '直近30日',
  '90d': '直近90日',
}

export interface UsageSeriesPoint {
  date: string
  count: number
}

export interface AiUsageRow {
  kind: string
  label: string
  count: number
  tokens: number
  credits: number
}

export interface ImageUsageRow {
  kind: string
  label: string
  count: number
  /** そのうちキャッシュで済んだ枚数。クレジットは消費しているが生成はしていない */
  cached: number
}

export interface UsageSummary {
  period: UsagePeriod
  period_label: string
  since: string
  until: string
  days: number
  ai: {
    total_count: number
    total_tokens: number
    total_credits: number
    /** 1日の呼び出し上限。0 以下なら無効 */
    daily_cap: number
    used_today: number
    by_kind: AiUsageRow[]
    daily: UsageSeriesPoint[]
  }
  images: {
    total_count: number
    cached_count: number
    by_kind: ImageUsageRow[]
    daily: UsageSeriesPoint[]
  }
  credits: { consumed: number; daily: UsageSeriesPoint[] }
  items: { created: number; daily: UsageSeriesPoint[] }
}

/** 推移グラフで選べる対象 */
export type UsageMetric = 'credits' | 'items' | 'ai' | 'images'

export const USAGE_METRICS: Record<
  UsageMetric,
  { label: string; unit: string; pick: (usage: UsageSummary) => UsageSeriesPoint[] }
> = {
  credits: { label: 'クレジット消費', unit: ' cr', pick: (u) => u.credits.daily },
  items: { label: 'カード作成', unit: ' 枚', pick: (u) => u.items.daily },
  ai: { label: '文章のAI', unit: ' 回', pick: (u) => u.ai.daily },
  images: { label: '画像の生成', unit: ' 枚', pick: (u) => u.images.daily },
}

// クレジットの増減の明細（バックエンド /api/v1/billing/credit_transactions に対応）
export interface CreditTransaction {
  id: string
  kind: string
  label: string
  /** 符号付き。増えたら正、減ったら負 */
  credits: number
  description: string | null
  item_id: string | null
  subscription_credits_after: number | null
  topup_credits_after: number | null
  created_at: string
}

export interface CreditTransactionsPage {
  transactions: CreditTransaction[]
  next_cursor: string | null
}
