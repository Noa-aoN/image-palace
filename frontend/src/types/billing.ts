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
  plan: { name: string; tier: string; credits_per_period: number } | null
  subscription: {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
}
