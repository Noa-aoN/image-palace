import { apiClient } from './client'
import type { BillingPlan, BillingSummary } from '@/types/billing'

export async function getPlans(): Promise<BillingPlan[]> {
  const res = await apiClient.get<{ plans: BillingPlan[] }>('/api/v1/billing/plans')
  return res.data.plans
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const res = await apiClient.get<BillingSummary>('/api/v1/billing/summary')
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
