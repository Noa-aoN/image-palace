// 課金関連の型（バックエンド /api/v1/billing/* のレスポンスに対応）

export type BillingPlan = {
  name: string
  tier: string
  kind: 'subscription' | 'one_time'
  interval: string | null
  price: number // JPY は最小単位＝円
  currency: string
  credits: number
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
}
