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
  series: {
    days: number
    new_users: AdminSeriesPoint[]
    new_items: AdminSeriesPoint[]
  }
  top_creators: { user_id: string; items: number }[]
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
