// 運営（管理）画面の型。バックエンド /api/v1/admin/* のレスポンスに対応。

export type AdminRole = 'user' | 'admin' | 'owner'

export interface AdminSession {
  admin: boolean
  owner: boolean
  role: AdminRole
}

export interface AdminSeriesPoint {
  date: string
  count: number
}

export interface AdminOverview {
  generated_at: string
  users: {
    total: number
    confirmed: number
    new_last_7d: number
    new_last_30d: number
    active_last_30d: number
    admins: number
  }
  content: {
    items: number
    views: number
    spaces: number
    boxes: number
    wordlists: number
    tags: number
  }
  generation: {
    by_status: Record<string, number>
    items_last_30d: number
    shared_medias: number
    /** 同じ単語を作り直さずに済んだ割合（%） */
    cache_hit_rate: number
    shared_briefs: number
  }
  /** 未使用クレジット（受け取ったのにまだ提供していないぶん） */
  credit_liability: {
    expiring: number
    unlimited: number
    total: number
    breakdown: { subscription: number; topup: number; grant: number }
    expired_last_30d: number
    /** 未使用の買い切りぶんを金額に換算した目安（円） */
    unused_topup_value: number
    next_expiry_at: string | null
  }
  billing: {
    active_subscriptions: number
    paid_rate: number
    by_plan: Record<string, number>
    credits_consumed_last_30d: number
    outstanding_credits: number
  }
  ai: {
    calls_last_30d: number
    tokens_last_30d: number
    by_kind: { kind: string; label: string; count: number; tokens: number }[]
  }
  /** いま効いている上限。値の出どころ（ENV 名）も含む */
  limits: {
    image: {
      /** 画像の枚数は固定の月上限ではなくクレジット残高で決まる */
      gate: 'credits'
      trial_credits: number
      monthly_free_credits: number
      credit_lifetime_months: number
      plans: { name: string; price: number; monthly_credits: number }[]
    }
    ai: {
      daily_call_cap: number
      daily_call_cap_env: string
      cost_points: {
        kind: string
        label: string
        points: number
        env: string
        /** 環境変数で既定から上書きされているか */
        overridden: boolean
      }[]
    }
  }
  /** 供給側（OpenAI 等）が止まっていないか */
  provider_status: {
    ongoing: boolean
    last_incident: {
      provider: string
      kind: string
      code: string | null
      occurrences: number
      first_occurred_at: string
      last_occurred_at: string
    } | null
  }
  series: {
    days: number
    new_users: AdminSeriesPoint[]
    new_items: AdminSeriesPoint[]
  }
  top_creators: { user_id: string; items: number }[]
}

/** 付与ポリシー（何を・いくつ・どの条件で配るか） */
export interface AdminGrantPolicy {
  key: string
  label: string
  description: string | null
  reward_type: 'credits' | 'item'
  enabled: boolean
  amount: number
  item_kind: string | null
  conditions: Record<string, unknown>
  notes: string | null
  /** 画面で触った結果か（false なら Billing::Catalog の既定で動いている） */
  customized: boolean
  default_amount: number | null
}

export interface AdminGrantPoliciesPage {
  policies: AdminGrantPolicy[]
  item_kinds: string[]
  reward_types: string[]
}

/** プラン（ユーザー種類）ごとの付与 */
export interface AdminPlan {
  id: string
  name: string
  tier: string | null
  kind: string
  price: number | null
  credits_per_period: number
  active: boolean
  /** 粗利率(%)。無料プランなど対象外は null */
  margin: number | null
  stripe_linked: boolean
}

export interface AdminPlansPage {
  plans: AdminPlan[]
  min_margin: number
  cost_per_credit: number
  stripe_fee_rate: number
}

/** 供給側の疎通確認の結果 */
export interface AdminProviderCheck {
  ok: boolean
  code: string | null
  message: string | null
  checked_at: string
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: AdminRole
  /** 環境変数で指定されているため画面から変えられない */
  role_locked: boolean
  confirmed: boolean
  provider: string
  items: number
  available_credits: number
  plan: string | null
  created_at: string
}

export interface AdminUsersPage {
  users: AdminUser[]
  meta: { page: number; per: number; total_count: number; total_pages: number }
}

export interface AdminAuditLog {
  id: string
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}
