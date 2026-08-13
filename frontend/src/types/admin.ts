// 運営（管理）画面の型。バックエンド /api/v1/admin/* のレスポンスに対応。

// 期間の型は、選ぶ部品（PeriodSelect）と同じものを使う。
// ここで別に定義すると、片方だけ直したときに食い違う
export type { AdminPeriod } from '@/components/features/admin/PeriodSelect'
import type { AdminPeriod } from '@/components/features/admin/PeriodSelect'

/**
 * 役割は4段階。**上位は下位を含む。**
 *   user     … 一般。/admin には入れない
 *   support  … 閲覧・調査。見るだけ
 *   operator … 通常運用。配信・付与・設定変更
 *   admin    … 最上位。権限・お金・セキュリティ
 */
export type AdminRole = 'user' | 'support' | 'operator' | 'admin'

export interface AdminSession {
  /** 運営の入口に入れるか（support 以上） */
  admin: boolean
  /** 権限・お金を触れるか（admin のみ）。名前は据え置き（画面側の参照が多いため） */
  owner: boolean
  role: AdminRole
  strong_auth: AdminStrongAuth
}

/**
 * 執務室に入る前の、もう一度の本人確認。
 *
 * 3つの値で、画面が出すものが決まる。
 *   required=false          … これまでどおり。何も出さない
 *   prepared=false          … 手立てが無い。設定へ案内する
 *   satisfied=false         … 確かめてもらう
 */
export interface AdminStrongAuth {
  /** いま求めているか */
  required: boolean
  /**
   * 以下は求めているときだけ返る。
   * ここはログインしている全員が通る経路なので、
   * 誰も見ない値のために問い合わせを増やさない
   */
  /** この端末が確かめ済みか */
  satisfied?: boolean
  /** パスキーか認証アプリを持っているか */
  prepared?: boolean
  /** 使える確かめ方。使いやすい順 */
  methods?: ('passkey' | 'totp' | 'recovery_code')[]
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
    new_in_period: number
    active_in_period: number
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
    items_in_period: number
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
    /** 全部使われたら出ていく原価の目安（円）。unused_topup_value とは別物（あちらは預り金） */
    total_cost_jpy: number
    /** クレジット1つ（＝画像1枚）の実費（円）。収支ページの画像原価と同じ出どころ */
    credit_unit_cost_jpy: number
    breakdown: { subscription: number; topup: number; grant: number }
    expired_in_period: number
    /** 買い切りで受け取った額のうち、まだ提供していないぶん（円） */
    unused_topup_value: number
    next_expiry_at: string | null
  }
  /** いま見ている期間。選べる候補も併せて返る（収支ページと同じ語彙） */
  period: AdminPeriod
  billing: {
    active_subscriptions: number
    /** テストの契約を除いた数。目印を持たない古い行はテスト扱い */
    live_subscriptions: number
    test_subscriptions: number
    /** お試し中。まだお金は入っていない */
    trialing_subscriptions: number
    /** 今期の終わりで切れるもの */
    canceling_subscriptions: number
    paid_rate: number
    by_plan: { name: string; tier: string | null; count: number; mrr_jpy: number }[]
    /** その期間に使われたクレジット */
    credits_consumed: number
    outstanding_credits: number
  }
  ai: {
    calls_in_period: number
    tokens_in_period: number
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
  /** 今月の収支（概算）。詳細は /admin/finance */
  finance: AdminFinanceSummary
  /** ジョブの滞留。stalled は「積まれているのに動かす者がいない」状態 */
  queue: {
    ready: number
    claimed: number
    workers: number
    last_heartbeat_at: string | null
    stalled: boolean
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
/** AI モデルの登録簿の1行 */
export interface AdminAiModel {
  id: string
  key: string
  kind: 'image' | 'text'
  provider: string
  model_id: string
  label: string
  description: string | null
  enabled: boolean
  /** 利用者に選ばせるか */
  visible: boolean
  default_for_kind: boolean
  /** 使ってよい用途。空ならすべて */
  purposes: string[]
  /** 1回あたりの消費（ポイント）。null なら既定 */
  credit_points: number | null
  /** 原価。画像は USD/枚、文章は入力の USD/1Mトークン */
  unit_cost_usd: number | null
  output_cost_usd: number | null
  daily_limit: number | null
  requires_env: string | null
  notes: string | null
  position: number
  /** コード側に定義があるもの。消せない */
  builtin: boolean
  /** 鍵が入っていて実際に使えるか。enabled とは別 */
  available: boolean
  used_today: number | null
  /** 直近の使用回数 */
  used_recently: number
  /** その種類（画像／文章）の中での割合。分母が0なら null */
  share: number | null
  /** そのうちキャッシュで済んだ回数（画像のみ） */
  cached_recently: number | null
}

export interface AdminAiModelsPage {
  models: AdminAiModel[]
  period: AdminPeriod
  kinds: string[]
  providers: string[]
  purposes: string[]
  points_per_credit: number
  /** 使用状況を数えている日数 */
  usage_days: number
}

/** 引き換えコード（運営が発行し、利用者が入力してクレジットを受け取る） */
export interface AdminCampaignCode {
  id: string
  code: string
  label: string
  reward_type: 'credits' | 'item'
  amount: number
  item_kind: string | null
  starts_at: string | null
  expires_at: string | null
  max_redemptions: number | null
  credit_valid_days: number | null
  enabled: boolean
  notes: string | null
  created_at: string
  redeemed_count: number
  granted_credits: number
  /** 受け取り数 ÷ 上限。上限を決めていなければ null（分母が無い） */
  redemption_rate: number | null
  available: boolean
}

export interface AdminCampaignCodesPage {
  codes: AdminCampaignCode[]
  reward_types: string[]
  suggested_code: string
}

/** 作りかけの機能を、どこまで見せるか */
export interface AdminFeatureFlag {
  key: string
  label: string
  /** サイドバーの分類（palace / outside / ops / other） */
  group: string
  group_label: string
  /** ページなら URL。ページ以外は null */
  path: string | null
  note: string | null
  stage: string
  default_stage: string
  /** 画面で触った結果か（false ならコード側の既定で動いている） */
  customized: boolean
  notes: string | null
}

export interface AdminFeatureFlagsPage {
  features: AdminFeatureFlag[]
  stages: { value: string; label: string }[]
  groups: { key: string; label: string }[]
}

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
  /** 受け取り側の仕組みがあるか。false なら準備中で「配る」にできない */
  ready: boolean
}

export interface AdminGrantPoliciesPage {
  policies: AdminGrantPolicy[]
  item_kinds: string[]
  /** 実際に配れる種類。ここに無いものは準備中 */
  ready_item_kinds: string[]
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

export interface AdminUserStats {
  total: number
  confirmed: number
  admins: number
  new_this_month: number
  new_last_month: number
  /** 前月比(%)。前月が0なら null */
  growth_rate: number | null
  monthly: { month: string; count: number; cumulative: number }[]
}

export interface AdminUsersPage {
  users: AdminUser[]
  period: AdminPeriod
  meta: { page: number; per: number; total_count: number; total_pages: number }
  stats: AdminUserStats
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

// ── 支出入 ──────────────────────────────────────────────────

export interface AdminFinanceSummary {
  period: { year: number | null; month: number | null; from: string; to: string }
  revenue: { total: number; by_kind: Record<string, number> }
  /** テストの決済（売上には入れない）。0 でなければ画面に断りを出す */
  test_revenue: number
  /** 「本番」か「テスト」か。いまの Stripe の鍵で決まる */
  mode: string
  cost: {
    total: number
    stripe_fee: number
    image: {
      count: number
      jpy: number
      breakdown: { model: string; quality: string | null; kind: string; count: number; usd: number; jpy: number }[]
    }
    text: {
      calls: number
      jpy: number
      breakdown: { model: string; calls: number; prompt_tokens: number; completion_tokens: number; usd: number; jpy: number }[]
    }
    infra: number
  }
  profit: number
  /** 粗利率(%)。売上0なら null */
  margin: number | null
  /** 請求実額との比較。未入力なら recorded=false */
  actual: {
    recorded: boolean
    estimated: number
    actual?: number
    openai?: number
    infra?: number
    other?: number
    diff?: number
    diff_rate?: number | null
    note?: string | null
  }
  fx: number
}

export interface AdminCostParameter {
  key: string
  group: string
  label: string
  unit: string | null
  description: string | null
  value: number
  default_value: number | null
  customized: boolean
  note: string | null
}

export interface AdminFinancePage {
  summary: AdminFinanceSummary
  /** いま見ている期間。選び方は他の運営画面と共通 */
  period: AdminPeriod
  /** 開業からの積み上げ。months は稼働月数（インフラ月額を掛けた数） */
  totals: AdminFinanceSummary & { months: number }
  available_months: { year: number; month: number }[]
  trend: { year: number; month: number; revenue: number; cost: number; profit: number }[]
  parameters: AdminCostParameter[]
  groups: string[]
}

/**
 * 経営の数字（Business Analytics）。
 *
 * **出せないものは null で返る。** 0 と null は違う意味なので、画面でも分けて出すこと。
 * 「測って 0 だった」と「そもそも測れない」を同じ見た目にしない。
 */
export interface AdminBusinessMetrics {
  generated_at: string
  period: AdminPeriod
  measurement: {
    /** 来訪の記録が始まった時刻。まだ誰も来ていなければ null */
    last_seen_since: string | null
    /** 選んだ期間の途中から計測が始まっているか */
    last_seen_partial: boolean
    note: string
  }
  /** 来た人。last_seen_at から数える */
  active: {
    measured: boolean
    dau: number | null
    wau: number | null
    mau: number | null
    /** DAU ÷ MAU（%） */
    stickiness: number | null
    /**
     * 前期間と比べられるか。**常に false**。
     * 持っているのは利用者ごとの「最後に来た日」1点だけで、
     * 昨日その人が来ていたかは復元できない
     */
    comparable: boolean
  }
  /** 使った人。実際の行動から数える */
  engagement: {
    current: AdminEngagementCounts
    previous: AdminEngagementCounts
    actions_per_acting_user: number | null
  }
  users: {
    total: number
    new_in_period: number
    new_in_previous: number
    paying: number
    free_to_paid_cvr: number | null
  }
  revenue: {
    total_jpy: number
    previous_total_jpy: number
    mrr_jpy: number
    arr_jpy: number
    arpu_jpy: number | null
    arppu_jpy: number | null
    test_revenue_jpy: number
  }
  retention: {
    canceled_in_period: number
    active_at_period_start: number
    churn_rate: number | null
    /** 率を出せないときの理由 */
    note: string | null
  }
  unit_economics: {
    ai_cost_jpy: number
    ai_cost_per_user_jpy: number | null
    gross_profit_jpy: number
    gross_margin: number | null
    /** 粗利の内訳。売上 −（手数料 + 画像 + 文章 + インフラ）= 粗利 が閉じる */
    cost_breakdown: {
      revenue_jpy: number
      stripe_fee_jpy: number
      image_jpy: number
      text_jpy: number
      infra_jpy: number
      total_jpy: number
      infra_months: number
    }
    ltv: {
      value_jpy: number | null
      /** 常に true。母数が小さいので参考値としてしか使えない */
      reference: boolean
      basis: string
      average_months?: number | null
    }
  }
}

export interface AdminEngagementCounts {
  cards_created: number
  images_generated: number
  reviews: number
  credits_consumed: number
  acting_users: number
  actions: number
}
