import { apiClient } from './client'
import type {
  AdminBrief,
  AdminAuditLog,
  AdminBusinessMetrics,
  AdminCostParameter,
  AdminFinancePage,
  AdminFinanceSummary,
  AdminGrantPoliciesPage,
  AdminAiModel,
  AdminAiModelsPage,
  AdminCampaignCode,
  AdminCampaignCodesPage,
  AdminFeatureFlag,
  AdminFeatureFlagsPage,
  AdminGrantPolicy,
  AdminOverview,
  AdminPlan,
  AdminPlansPage,
  AdminProviderCheck,
  AdminRole,
  AdminSession,
  AdminUser,
  AdminUsersPage,
  AdminPeriod,
} from '@/types/admin'

// いま入っている人の運営権限。一般ユーザーが呼んでもエラーにはならない
export async function getAdminSession(): Promise<AdminSession> {
  const res = await apiClient.get<AdminSession>('/api/v1/admin/session')
  return res.data
}

// period で期間を切り替える（7d / 30d / 90d / 6m / 1y / all / 2026-07）。
// 知らない値はサーバー側で既定に丸まる
export async function getAdminOverview(params?: { period?: string }): Promise<AdminOverview> {
  const res = await apiClient.get<AdminOverview>('/api/v1/admin/overview', { params })
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
  /** 登録日で絞る。既定は全期間（探しに来る面なので、古い人を落とさない） */
  period?: string
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
  period: AdminPeriod
}

export async function getAdminAuditLogs(params?: {
  action_name?: string
  actor?: string
  /** 記録された日で絞る。既定は全期間 */
  period?: string
}): Promise<AdminAuditLogsPage> {
  const res = await apiClient.get<AdminAuditLogsPage>('/api/v1/admin/audit_logs', { params })
  return res.data
}

export async function getAdminAuditLogList(): Promise<AdminAuditLog[]> {
  const res = await apiClient.get<{ logs: AdminAuditLog[] }>('/api/v1/admin/audit_logs')
  return res.data.logs
}

// ── AIモデルの登録簿 ──────────────────────────────────────────

// period は概要ページと同じ語彙（7d / 30d / 90d / 6m / 1y / all / 2026-07）
export async function getAdminAiModels(params?: { period?: string }): Promise<AdminAiModelsPage> {
  const res = await apiClient.get<AdminAiModelsPage>('/api/v1/admin/ai_models', { params })
  return res.data
}

export async function createAdminAiModel(ai_model: {
  key: string
  kind: string
  provider: string
  model_id: string
  label: string
  credit_points?: number | null
  unit_cost_usd?: number | null
  requires_env?: string | null
}): Promise<AdminAiModel> {
  const res = await apiClient.post<{ model: AdminAiModel }>('/api/v1/admin/ai_models', { ai_model })
  return res.data.model
}

// キーは変えられない（コードとカードが参照しているため）
export async function updateAdminAiModel(
  id: string,
  ai_model: Partial<Omit<AdminAiModel, 'id' | 'key' | 'builtin' | 'available' | 'used_today'>>
): Promise<AdminAiModel> {
  const res = await apiClient.patch<{ model: AdminAiModel }>(`/api/v1/admin/ai_models/${id}`, { ai_model })
  return res.data.model
}

export async function deleteAdminAiModel(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/ai_models/${id}`)
}

// ── 引き換えコード ────────────────────────────────────────────

export async function getAdminCampaignCodes(): Promise<AdminCampaignCodesPage> {
  const res = await apiClient.get<AdminCampaignCodesPage>('/api/v1/admin/campaign_codes')
  return res.data
}

// コードは省略できる。省略すると、読み違えにくい字だけで自動生成される
export async function createAdminCampaignCode(campaign_code: {
  label: string
  amount: number
  code?: string
  max_redemptions?: number | null
  expires_at?: string | null
  credit_valid_days?: number | null
  notes?: string | null
}): Promise<AdminCampaignCode> {
  const res = await apiClient.post<{ code: AdminCampaignCode }>('/api/v1/admin/campaign_codes', { campaign_code })
  return res.data.code
}

// コード文字列そのものは変えられない（配ったあとに変えると、配った先で通らなくなる）
export async function updateAdminCampaignCode(
  id: string,
  campaign_code: Partial<Pick<AdminCampaignCode, 'label' | 'amount' | 'max_redemptions' | 'expires_at' | 'enabled' | 'notes'>>
): Promise<AdminCampaignCode> {
  const res = await apiClient.patch<{ code: AdminCampaignCode }>(`/api/v1/admin/campaign_codes/${id}`, { campaign_code })
  return res.data.code
}

export async function deleteAdminCampaignCode(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/campaign_codes/${id}`)
}

// ── 機能の見せ方 ──────────────────────────────────────────────

export async function getAdminFeatureFlags(): Promise<AdminFeatureFlagsPage> {
  const res = await apiClient.get<AdminFeatureFlagsPage>('/api/v1/admin/feature_flags')
  return res.data
}

// 触ったときに初めて行ができ、以後はそちらが効く
export async function updateAdminFeatureFlag(
  key: string,
  feature: { stage?: string; notes?: string }
): Promise<AdminFeatureFlag> {
  const res = await apiClient.put<{ feature: AdminFeatureFlag }>(`/api/v1/admin/feature_flags/${key}`, { feature })
  return res.data.feature
}

// 既定へ戻す（行を消す）
export async function resetAdminFeatureFlag(key: string): Promise<AdminFeatureFlag> {
  const res = await apiClient.delete<{ feature: AdminFeatureFlag }>(`/api/v1/admin/feature_flags/${key}`)
  return res.data.feature
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

// period は他の運営画面と同じ語彙（7d / 30d / 90d / 6m / 1y / all / 2026-07）。
// 既定は今月（締めた月の実績を見に来る面なので、直近◯日ではない）
export async function getAdminFinance(params?: { period?: string }): Promise<AdminFinancePage> {
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

// ── 獲得物・実績・ミッション ──
// 3つは別の表だが、運営から見ると「何を配るか」という1つの話なので1つの入口にまとめる

export interface AdminRewardDefinition {
  id: string
  key: string
  kind: string
  kind_label: string
  name: string
  description: string | null
  rarity_level: number
  rarity_tier: string
  category: string | null
  published: boolean
  image_path: string | null
  /** そのまま開ける形。無ければ null（画面が種別ごとの既定の絵柄で描く） */
  image_url: string | null
  builtin: boolean
  /** 何人が持っているか。配りすぎ・配らなすぎに気づくため */
  /** 持っている人数 */
  owned_count: number
  /** 配った総数。宝物は1人が複数持てるので、人数だけでは配りすぎに気づけない */
  granted_total: number
  /** 同じものを複数持てるか（宝物だけ） */
  stackable: boolean
}

export interface AdminAchievementDefinition {
  id: string
  key: string
  name: string
  description: string | null
  category: string | null
  condition_type: string
  condition_target: number
  position: number
  enabled: boolean
  published: boolean
  rewards: unknown[]
  builtin: boolean
  completed_count: number
}

export interface AdminMissionDefinition {
  id: string
  key: string
  name: string
  description: string | null
  cadence: string
  condition_type: string
  condition_target: number
  position: number
  enabled: boolean
  published: boolean
  starts_at: string | null
  ends_at: string | null
  mission_series_id: string | null
  series_step: number
  rewards: unknown[]
  builtin: boolean
}

export interface AdminMissionSeries {
  id: string
  key: string
  name: string
  description: string | null
  position: number
  enabled: boolean
  published: boolean
  builtin: boolean
}

export interface AdminRewardsPage {
  rewards: AdminRewardDefinition[]
  achievements: AdminAchievementDefinition[]
  missions: AdminMissionDefinition[]
  series: AdminMissionSeries[]
  kinds: string[]
  rarity_levels: number[]
  categories: string[]
  cadences: string[]
  condition_types: { value: string; label: string }[]
}

export async function getAdminRewards(): Promise<AdminRewardsPage> {
  const res = await apiClient.get<AdminRewardsPage>('/api/v1/admin/rewards')
  return res.data
}

export async function updateAdminRewardDefinition(
  id: string,
  reward: Partial<Pick<AdminRewardDefinition, 'name' | 'description' | 'rarity_level' | 'category' | 'published'>>
): Promise<AdminRewardDefinition> {
  const res = await apiClient.patch<{ reward: AdminRewardDefinition }>(
    `/api/v1/admin/rewards/definitions/${id}`,
    { reward }
  )
  return res.data.reward
}

export async function updateAdminAchievement(
  id: string,
  achievement: Partial<
    Pick<AdminAchievementDefinition, 'name' | 'description' | 'category' | 'condition_target' | 'enabled' | 'published'>
  >
): Promise<AdminAchievementDefinition> {
  const res = await apiClient.patch<{ achievement: AdminAchievementDefinition }>(
    `/api/v1/admin/rewards/achievements/${id}`,
    { achievement }
  )
  return res.data.achievement
}

export async function updateAdminMission(
  id: string,
  mission: Partial<
    Pick<
      AdminMissionDefinition,
      'name' | 'description' | 'cadence' | 'condition_target' | 'enabled' | 'published' | 'starts_at' | 'ends_at'
    >
  >
): Promise<AdminMissionDefinition> {
  const res = await apiClient.patch<{ mission: AdminMissionDefinition }>(
    `/api/v1/admin/rewards/missions/${id}`,
    { mission }
  )
  return res.data.mission
}

/** 手で配る。理由は必須（サーバー側でも空を弾く） */
export async function grantAdminReward(input: {
  user_id: string
  reward_key: string
  reason: string
  /**
   * 同じ操作かどうかを判じる鍵。押し直し・再送では**同じ値**を送る。
   *
   * 理由（reason）は鍵にしない。同じ理由で別の日に配るのは正しい2回目で、
   * 理由を鍵にすると、その正しい配布まで止まる
   */
  event_key?: string
}): Promise<{ granted: boolean }> {
  const res = await apiClient.post<{ granted: boolean }>('/api/v1/admin/rewards/grant', input)
  return res.data
}

// 経営の数字。期間の指定は運営ダッシュボードと同じ（Admin::Period）
export async function getAdminBusinessMetrics(params?: {
  period?: string
}): Promise<AdminBusinessMetrics> {
  const res = await apiClient.get<AdminBusinessMetrics>('/api/v1/admin/business', { params })
  return res.data
}

/**
 * いまある見立てを読む。**開くだけでは作らない。**
 * 作るのは明示的に更新したときだけ（見るだけの人が費用を積み上げないため）。
 */
export async function getAdminBrief(): Promise<AdminBrief | null> {
  const res = await apiClient.get<{ brief: AdminBrief | null }>('/api/v1/admin/brief')
  return res.data.brief
}

export async function generateAdminBrief(period?: string): Promise<AdminBrief | null> {
  const res = await apiClient.post<{ brief: AdminBrief | null }>('/api/v1/admin/brief', { period })
  return res.data.brief
}

/**
 * 定義を新しく作る。**「手で配る」とは別**。
 *
 * ここで増えるのは「何があるか」であって、誰かの持ち物ではない。
 * 配るのは grantAdminReward（手で配る）と、条件を満たしたときの自動付与。
 */
export async function createAdminRewardDefinition(reward: {
  key: string
  kind: string
  name: string
  description?: string
  rarity_level?: number
  category?: string
  published?: boolean
  enabled?: boolean
}): Promise<{ reward: AdminRewardDefinition }> {
  const res = await apiClient.post<{ reward: AdminRewardDefinition }>(
    '/api/v1/admin/rewards/definitions',
    { reward }
  )
  return res.data
}

export async function createAdminAchievement(achievement: {
  key: string
  name: string
  description?: string
  category?: string
  condition_type: string
  condition_target?: number
  published?: boolean
  enabled?: boolean
  rewards?: { type: string; key?: string; amount?: number }[]
}): Promise<{ achievement: AdminAchievementDefinition }> {
  const res = await apiClient.post<{ achievement: AdminAchievementDefinition }>(
    '/api/v1/admin/rewards/achievements',
    { achievement }
  )
  return res.data
}

export async function createAdminMission(mission: {
  key: string
  name: string
  description?: string
  cadence: string
  condition_type: string
  condition_target?: number
  published?: boolean
  enabled?: boolean
  starts_at?: string | null
  ends_at?: string | null
  rewards?: { type: string; key?: string; amount?: number }[]
}): Promise<{ mission: AdminMissionDefinition }> {
  const res = await apiClient.post<{ mission: AdminMissionDefinition }>(
    '/api/v1/admin/rewards/missions',
    { mission }
  )
  return res.data
}

/**
 * 獲得物の絵を作る（AI に描かせる）。
 *
 * 仕組みは以前からあったが、コマンドからしか呼べなかった。
 * **作った獲得物に、その場で絵を付けられる**ようにするための口。
 */
export async function generateAdminRewardImage(id: string): Promise<{ reward: AdminRewardDefinition }> {
  const res = await apiClient.post<{ reward: AdminRewardDefinition }>(
    `/api/v1/admin/rewards/definitions/${id}/image`
  )
  return res.data
}

/** 絵を外す。定義は残る（絵が無ければ種別ごとの既定の絵柄で出る） */
export async function deleteAdminRewardImage(id: string): Promise<{ reward: AdminRewardDefinition }> {
  const res = await apiClient.delete<{ reward: AdminRewardDefinition }>(
    `/api/v1/admin/rewards/definitions/${id}/image`
  )
  return res.data
}
