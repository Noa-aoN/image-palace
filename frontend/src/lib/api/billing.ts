import { apiClient } from './client'
import type { AiUsageSummary, BillingPlan, BillingSummary } from '@/types/billing'

export async function getPlans(): Promise<BillingPlan[]> {
  const res = await apiClient.get<{ plans: BillingPlan[] }>('/api/v1/billing/plans')
  return res.data.plans
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const res = await apiClient.get<BillingSummary>('/api/v1/billing/summary')
  return res.data
}

// 画像以外の AI 利用の内訳（既定30日ぶん）
export async function getAiUsage(days?: number): Promise<AiUsageSummary> {
  const res = await apiClient.get<AiUsageSummary>('/api/v1/billing/ai_usage', {
    params: days ? { days } : undefined,
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
