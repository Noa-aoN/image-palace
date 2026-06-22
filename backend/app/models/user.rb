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
  has_many :decks, dependent: :destroy
  has_many :collections, dependent: :destroy
  has_many :spaces, dependent: :destroy
  has_many :space_points, through: :spaces
  has_many :views, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :relations, dependent: :destroy
  has_many :shared_medias, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  has_one :active_subscription, -> { where(status: "active") }, class_name: "Subscription"
  has_many :credit_transactions, dependent: :destroy

  # 当月の生成数。カード（items）と、名前付きスペースポイント（画像生成を伴う）を
  # 合算して数える。月間生成上限（月100枚）は両者で共有する。
  def monthly_generation_count
    items.created_this_month.count + space_points.named.created_this_month.count
  end

  # == クレジット =============================================================
  # 残高は2バケット制：subscription_credits（月次リセット）+ topup_credits（繰り越し）。
  # 履歴は credit_transactions に追記する（監査用の append-only 台帳）。
  class InsufficientCredits < StandardError; end

  def available_credits
    subscription_credits + topup_credits
  end

  # サブスク分を毎月リセットする（旧残分は失効ログを残す）。invoice 支払い時などに呼ぶ。
  def reset_subscription_credits!(amount, subscription: nil, stripe_event_id: nil)
    with_lock do
      forfeited = subscription_credits
      if forfeited.positive?
        record_credit!(kind: "subscription_expire", delta: -forfeited, subscription:)
      end
      update!(subscription_credits: amount)
      record_credit!(kind: "subscription_grant", delta: amount, subscription:, stripe_event_id:)
    end
  end

  # Top-up（買い切り）クレジットを加算する。
  def add_topup_credits!(amount, stripe_event_id: nil)
    with_lock do
      increment!(:topup_credits, amount)
      record_credit!(kind: "topup_purchase", delta: amount, stripe_event_id:)
    end
  end

  # 生成1件ぶんなどを消費する。サブスク分→Top-up の順に引く。
  def consume_credits!(amount, item: nil, space_point_id: nil)
    with_lock do
      raise InsufficientCredits, "クレジットが不足しています" if available_credits < amount

      from_subscription = [ subscription_credits, amount ].min
      from_topup = amount - from_subscription
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
