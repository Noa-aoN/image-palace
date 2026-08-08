import { apiClient } from './client'
import type {
  AdminAuditLog,
  AdminCostParameter,
  AdminFinancePage,
  AdminFinanceSummary,
  AdminGrantPoliciesPage,
  AdminGrantPolicy,
  AdminOverview,
  AdminPlan,
  AdminPlansPage,
  AdminProviderCheck,
  AdminRole,
  AdminSession,
  AdminUser,
  AdminUsersPage,
} from '@/types/admin'

// いま入っている人の運営権限。一般ユーザーが呼んでもエラーにはならない
export async function getAdminSession(): Promise<AdminSession> {
  const res = await apiClient.get<AdminSession>('/api/v1/admin/session')
  return res.data
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await apiClient.get<AdminOverview>('/api/v1/admin/overview')
  return res.data
}

// 供給側（OpenAI）へ実際に1回投げて、いま応じるかを確かめる。
// 残高そのものは API から読めないため、残高切れは呼び出しの失敗として現れる
export async function checkAdminProvider(): Promise<AdminProviderCheck> {
  const res = await apiClient.post<AdminProviderCheck>('/api/v1/admin/provider_check')
  return res.data
}

export async function getAdminUsers(params: {
  q?: string
  role?: string
  page?: number
}): Promise<AdminUsersPage> {
  const res = await apiClient.get<AdminUsersPage>('/api/v1/admin/users', { params })
  return res.data
}

// 役割の変更（運営の管理者のみ）。譲渡もこれで行う
export async function updateAdminUserRole(id: string, role: AdminRole): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/api/v1/admin/users/${id}/role`, { role })
  return res.data
}

export interface AdminAuditLogsPage {
  logs: AdminAuditLog[]
  /** 絞り込みの選択肢（記録に出てくる種類・実行者） */
  actions: string[]
  actors: string[]
}

export async function getAdminAuditLogs(params?: {
  action_name?: string
  actor?: string
}): Promise<AdminAuditLogsPage> {
  const res = await apiClient.get<AdminAuditLogsPage>('/api/v1/admin/audit_logs', { params })
  return res.data
}

export async function getAdminAuditLogList(): Promise<AdminAuditLog[]> {
  const res = await apiClient.get<{ logs: AdminAuditLog[] }>('/api/v1/admin/audit_logs')
  return res.data.logs
}

// ── 付与の管理 ────────────────────────────────────────────────

export async function getAdminGrantPolicies(): Promise<AdminGrantPoliciesPage> {
  const res = await apiClient.get<AdminGrantPoliciesPage>('/api/v1/admin/grant_policies')
  return res.data
}

// キーごとに作成/更新する。触ったときに初めて行ができ、以後はそちらが効く
export async function updateAdminGrantPolicy(
  key: string,
  policy: Partial<Pick<AdminGrantPolicy, 'enabled' | 'amount' | 'item_kind' | 'notes' | 'reward_type'>>
): Promise<AdminGrantPolicy> {
  const res = await apiClient.put<{ policy: AdminGrantPolicy }>(`/api/v1/admin/grant_policies/${key}`, { policy })
  return res.data.policy
}

// 既定へ戻す（行を消す）
export async function resetAdminGrantPolicy(key: string): Promise<AdminGrantPolicy> {
  const res = await apiClient.delete<{ policy: AdminGrantPolicy }>(`/api/v1/admin/grant_policies/${key}`)
  return res.data.policy
}

export async function getAdminPlans(): Promise<AdminPlansPage> {
  const res = await apiClient.get<AdminPlansPage>('/api/v1/admin/plans')
  return res.data
}

export async function updateAdminPlan(
  id: string,
  plan: { credits_per_period?: number; active?: boolean }
): Promise<AdminPlan> {
  const res = await apiClient.patch<{ plan: AdminPlan }>(`/api/v1/admin/plans/${id}`, { plan })
  return res.data.plan
}


// ── 支出入 ──────────────────────────────────────────────────

export async function getAdminFinance(params?: { year?: number; month?: number }): Promise<AdminFinancePage> {
  const res = await apiClient.get<AdminFinancePage>('/api/v1/admin/finance', { params })
  return res.data
}

// 単価・レートの変更。触ったキーだけ行ができ、以後はそちらが効く
export async function updateAdminCostParameter(
  key: string,
  parameter: { value: number; note?: string }
): Promise<AdminCostParameter> {
  const res = await apiClient.put<{ parameter: AdminCostParameter }>(
    `/api/v1/admin/finance/parameters/${encodeURIComponent(key)}`,
    { parameter }
  )
  return res.data.parameter
}

// 請求実額の入力。概算との乖離を出すために使う
export async function updateAdminMonthlyActual(
  year: number,
  month: number,
  actual: { openai_jpy: number; infra_jpy: number; other_jpy: number; note?: string }
): Promise<AdminFinanceSummary> {
  const res = await apiClient.put<{ summary: AdminFinanceSummary }>(
    `/api/v1/admin/finance/actuals/${year}/${month}`,
    { actual }
  )
  return res.data.summary
}
