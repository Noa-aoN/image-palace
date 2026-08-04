import { apiClient } from './client'
import type {
  BillingPlan,
  BillingSummary,
  CreditTransactionsPage,
  UsagePeriod,
  UsageSummary,
} from '@/types/billing'

export async function getPlans(): Promise<BillingPlan[]> {
  const res = await apiClient.get<{ plans: BillingPlan[] }>('/api/v1/billing/plans')
  return res.data.plans
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const res = await apiClient.get<BillingSummary>('/api/v1/billing/summary')
  return res.data
}

// 使用量（AIの利用・クレジットの消費・カードの作成）。既定は今月ぶん
export async function getAiUsage(period?: UsagePeriod): Promise<UsageSummary> {
  const res = await apiClient.get<UsageSummary>('/api/v1/billing/ai_usage', {
    params: period ? { period } : undefined,
  })
  return res.data
}

// Stripe Checkout のURLを返す（呼び出し側で遷移する）
export async function createCheckoutSession(plan: string): Promise<string> {
  const res = await apiClient.post<{ url: string }>('/api/v1/billing/checkout', { plan })
  return res.data.url
}

// 支払いを取り込む。webhook が届かない環境でも反映でき、届いていれば二重にはならない。
// 決済 id を省くと、直近の支払いのうち未反映のものを拾って反映する。
export async function syncCheckout(sessionId?: string): Promise<{ status: string; applied: boolean }> {
  const res = await apiClient.post<{ status: string; applied: boolean }>('/api/v1/billing/checkout/sync', {
    ...(sessionId ? { session_id: sessionId } : {}),
  })
  return res.data
}

// Stripe Customer Portal のURLを返す（解約・支払い変更）
export async function createPortalSession(): Promise<string> {
  const res = await apiClient.post<{ url: string }>('/api/v1/billing/portal')
  return res.data.url
}

// クレジットの増減の明細。cursor で続きをたどる
export async function getCreditTransactions(
  cursor?: string | null,
  limit?: number
): Promise<CreditTransactionsPage> {
  const res = await apiClient.get<CreditTransactionsPage>('/api/v1/billing/credit_transactions', {
    params: { ...(cursor ? { cursor } : {}), ...(limit ? { limit } : {}) },
  })
  return res.data
}
