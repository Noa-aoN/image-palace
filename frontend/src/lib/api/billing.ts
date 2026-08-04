import { apiClient } from './client'
import type { BillingPlan, BillingSummary, UsagePeriod, UsageSummary } from '@/types/billing'

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

// Stripe Customer Portal のURLを返す（解約・支払い変更）
export async function createPortalSession(): Promise<string> {
  const res = await apiClient.post<{ url: string }>('/api/v1/billing/portal')
  return res.data.url
}
