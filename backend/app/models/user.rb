class User < ApplicationRecord
  # == Deviseモジュール ======================================================
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable,
         :omniauthable, omniauth_providers: [ :google_oauth2, :apple ]

  # == devise-token-auth設定 ================================================
  include DeviseTokenAuth::Concerns::User

  # == バリデーション =========================================================
  validates :uid, uniqueness: { scope: :provider }

  # == 関連付け ==============================================================
  has_one :setting, dependent: :destroy
  has_many :items, dependent: :destroy
  has_many :collections, dependent: :destroy
  has_many :spaces, dependent: :destroy
  has_many :space_points, through: :spaces
  has_many :views, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :wordlists, dependent: :destroy
  has_many :relations, dependent: :destroy
  has_many :shared_medias, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  # trialing も「有効な有料契約」として扱う（trial 中ユーザーに無料枠を二重付与しないため）。
  has_one :active_subscription, -> { where(status: %w[active trialing]) }, class_name: "Subscription"
  has_many :credit_transactions, dependent: :destroy
  has_many :credit_grants, dependent: :destroy

  # 当月の生成数。カード（items）と、名前付きスペースポイント（画像生成を伴う）を
  # 合算して数える。月間生成上限（月100枚）は両者で共有する。
  def monthly_generation_count
    items.created_this_month.count + space_points.named.created_this_month.count
  end

  # == クレジット =============================================================
  # 残高は2バケット制：subscription_credits（月次リセット）+ topup_credits（繰り越し）。
  # 履歴は credit_transactions に追記する（監査用の append-only 台帳）。
  class InsufficientCredits < StandardError; end

  # 残高（ポイント）。期限付きグラント + subscription_credits + topup_credits の合算。
  def available_credit_points
    grant_credit_points + subscription_credits + topup_credits
  end

  # 有効な期限付きグラントの残量合計（ポイント）。
  def grant_credit_points
    credit_grants.active.sum(:remaining_points)
  end

  # 表示用クレジット（1cr = Billing::POINTS_PER_CREDIT pt）。
  def available_credits
    available_credit_points.fdiv(Billing::POINTS_PER_CREDIT)
  end

  # 無料枠クレジットを「登録日アニバーサリー基準の現周期」に lazy 付与する。
  # 有料（active_subscription あり）は Stripe webhook 側で付与するため対象外。
  def ensure_current_period_credits!
    return if active_subscription.present?

    period_start = free_period_start
    return if credits_period_start && credits_period_start >= period_start

    free_credits = Plan.find_by(name: "free")&.credits_per_period.to_i
    reset_subscription_credits!(free_credits * Billing::POINTS_PER_CREDIT)
    update_column(:credits_period_start, period_start) # rubocop:disable Rails/SkipsModelValidations
  end

  # 無料枠の現周期の開始日時（登録日アニバーサリー基準・月次。有料の契約日周期と整合させる）。
  # 例: 1/15 登録なら毎月15日が周期境界。月末日は ActiveSupport が丸める（1/31→2/28 等）。
  def free_period_start(now = Time.current)
    anchor = created_at || now
    elapsed_months = (now.year - anchor.year) * 12 + (now.month - anchor.month)
    start = anchor + elapsed_months.months
    start -= 1.month if start > now
    start
  end

  # 次回の無料クレジット更新（回復）日。
  def next_free_credit_reset_at(now = Time.current)
    free_period_start(now) + 1.month
  end

  # サブスク分を毎月リセットする（旧残分は失効ログを残す）。invoice 支払い時などに呼ぶ。
  def reset_subscription_credits!(amount, subscription: nil, stripe_event_id: nil)
    with_lock do
      forfeited = subscription_credits
      if forfeited.positive?
        record_credit!(kind: "subscription_expire", delta: -forfeited, subscription:)
      end
      update!(subscription_credits: amount)
      # 解約時の失効（amount==0）では 0 デルタの付与ログを残さない。
      if amount.positive?
        record_credit!(kind: "subscription_grant", delta: amount, subscription:, stripe_event_id:)
      end
    end
  end

  # Top-up（買い切り）クレジットを加算する。
  def add_topup_credits!(amount, stripe_event_id: nil)
    with_lock do
      increment!(:topup_credits, amount)
      record_credit!(kind: "topup_purchase", delta: amount, stripe_event_id:)
    end
  end

  # 期限付きグラント（Free引き継ぎ・キャンペーン等）を付与する。
  def grant_credits!(amount, kind:, expires_at: nil, metadata: {})
    return if amount <= 0

    with_lock do
      credit_grants.create!(kind:, amount_points: amount, remaining_points: amount, expires_at:, metadata:)
      record_credit!(kind: "grant", delta: amount)
    end
  end

  # 生成1件ぶんなどを消費する。期限付きグラント（期限が近い順）→ サブスク → Top-up の順に引く。
  def consume_credits!(amount, item: nil, space_point_id: nil)
    with_lock do
      raise InsufficientCredits, "クレジットが不足しています" if available_credit_points < amount

      remaining = amount
      # 1) 期限付きグラント（失効ロスを避けるため期限の近い順）
      credit_grants.consume_order.each do |grant|
        break if remaining <= 0

        take = [ grant.remaining_points, remaining ].min
        grant.update!(remaining_points: grant.remaining_points - take)
        remaining -= take
      end
      # 2) サブスク → 3) Top-up
      from_subscription = [ subscription_credits, remaining ].min
      remaining -= from_subscription
      from_topup = remaining
      update!(
        subscription_credits: subscription_credits - from_subscription,
        topup_credits: topup_credits - from_topup
      )
      record_credit!(kind: "consumption", delta: -amount, item:, space_point_id:)
    end
  end

  # == クラスメソッド =========================================================
  # OAuthプロバイダーからユーザーを見出し作成
  def self.find_for_oauth(auth_hash)
    # provider + uid のみで既存ユーザーを検索
    user = find_by(provider: auth_hash["provider"], uid: auth_hash["uid"])

    if user
      # 既存ユーザーが見つかった場合 → そのまま返す
      user
    else
      # 見つからない場合 → 新規ユーザー作成
      create!(
        email: auth_hash["info"]["email"],
        provider: auth_hash["provider"],
        uid: auth_hash["uid"],
        name: auth_hash.dig("info", "name"),
        password: Devise.friendly_token[0, 20],
        confirmed_at: Time.now
      )
    end
  end

  private

  # クレジット台帳へ1件追記する（残高更新後の値をスナップショットとして残す）。
  def record_credit!(kind:, delta:, subscription: nil, item: nil, space_point_id: nil, stripe_event_id: nil)
    credit_transactions.create!(
      kind:,
      delta:,
      subscription:,
      item:,
      space_point_id:,
      stripe_event_id:,
      subscription_credits_after: subscription_credits,
      topup_credits_after: topup_credits
    )
  end
end
