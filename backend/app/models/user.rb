class User < ApplicationRecord
  # == Deviseモジュール ======================================================
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable,
         :omniauthable, omniauth_providers: [ :google_oauth2, :apple ]

  # == devise-token-auth設定 ================================================
  include DeviseTokenAuth::Concerns::User

  # == 役割 ==================================================================
  # user: 一般 / admin: 運営（閲覧・コンテンツ管理） / owner: 運営の管理者（権限の付け外し・譲渡）
  #
  # 権限の在り処は DB にする。将来チームが増えても、譲渡することになっても、
  # 環境変数を触らずに人を足したり移したりできるようにするため。
  #
  # ENV の ADMIN_EMAILS は「最初のひとり」を作るための入口であり、
  # 締め出されたときの逃げ道でもある。ここに書いたアドレスは常に owner として扱う。
  ROLES = %w[user admin owner].freeze
  validates :role, inclusion: { in: ROLES }

  # == バリデーション =========================================================
  validates :uid, uniqueness: { scope: :provider }

  # == 関連付け ==============================================================
  has_one :setting, dependent: :destroy
  has_many :items, dependent: :destroy
  has_many :property_definitions, dependent: :destroy
  has_many :item_reviews, dependent: :destroy
  has_many :boxes, dependent: :destroy
  has_many :spaces, dependent: :destroy
  has_many :space_points, through: :spaces
  has_many :views, dependent: :destroy
  has_many :tags, dependent: :destroy
  has_many :tag_groups, dependent: :destroy
  has_many :wordlists, dependent: :destroy
  has_many :relations, dependent: :destroy
  has_many :shared_medias, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  # trialing も「有効な有料契約」として扱う（trial 中ユーザーに無料枠を二重付与しないため）。
  has_one :active_subscription, -> { where(status: %w[active trialing]) }, class_name: "Subscription"
  has_many :notifications, dependent: :destroy
  has_many :credit_transactions, dependent: :destroy
  has_many :credit_grants, dependent: :destroy

  # == プロフィールアイコン（AI生成）========================================
  # GenerateAvatarJob が生成画像を添付する。avatar_thumb は一覧/ヘッダー用のサムネ。
  has_one_attached :avatar
  has_one_attached :avatar_thumb

  AVATAR_GENERATION_STATUSES = %w[pending processing completed failed].freeze

  # 生成ステータス遷移（エラーはクリア）。
  def update_avatar_status!(status)
    update!(avatar_generation_status: status, avatar_generation_error: nil)
  end

  # 生成失敗（ユーザー向け文言を保存）。
  def mark_avatar_failed!(message)
    update!(avatar_generation_status: "failed", avatar_generation_error: message)
  end

  # 当月の生成数。カード（items）と、名前付きスペースポイント（画像生成を伴う）を
  # 合算して数える。枚数の上限はクレジット残高で決まるので、これは実績の集計。
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

  # 無料枠を整える。登録直後の「お試し」と、毎月の少量。
  #
  # 無料枠は回収の当てがない支出なので、配る量も配る相手も絞る。
  #   お試し … 1回だけ。退会して登録し直しても再取得できない
  #   毎月分 … 訪れた人にだけ配る（来ない人には配られない）
  #
  # 有料契約がある人には配らない（プランのぶんが毎月届くため）。
  #
  # 「配ったか」を見てから配るので、行ロックの中で判断する。
  # 外でやると、同時に来たリクエストが揃って「まだ配っていない」を読み、
  # 人数分だけ配ってしまう（残高エンドポイントは画面が繰り返し叩くので、
  # 並べて投げるだけで何回でも受け取れてしまっていた）。
  def ensure_free_credits!
    return if active_subscription.present?
    # ほとんどの呼び出しは「もう配ってある」で終わる。そこでロックを取ると
    # 同じ人のリクエストが一列に並んでしまうので、先に安い判定で抜ける。
    return if free_grants_settled?

    with_lock do
      reload
      grant_trial_credits!
      grant_monthly_free_credits!
    end
  end

  # お試しも今期の毎月分も配り終えているか（ロックを取る前の早期判定）
  def free_grants_settled?
    trial_granted_at.present? &&
      credits_period_start.present? &&
      credits_period_start >= free_period_start
  end

  # 旧名。呼び出し側を一度に直さないための入口（意味は「無料枠を整えておく」で変わらない）
  alias ensure_current_period_credits! ensure_free_credits!

  def mark_trial_granted!
    update_column(:trial_granted_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
  end

  # 配った相手を照合するための識別子。アカウントを消しても残す方に渡す
  def trial_identifiers
    identifiers = { email: email }
    identifiers[:oauth] = "#{provider}:#{uid}" if provider.present? && provider != "email" && uid.present?
    identifiers
  end

  private

  def grant_trial_credits!
    return if trial_granted_at.present?

    amount = Billing::Catalog::TRIAL_CREDITS * Billing::POINTS_PER_CREDIT
    return if amount <= 0

    # 一度配った相手には配らない。退会して登録し直しても同じ
    return mark_trial_granted! if TrialGrantRecord.granted?(trial_identifiers)
    # 配りすぎのブレーカー。当たった場合は配らないが、印は付けて何度も試させない
    return mark_trial_granted! unless Billing::FreeGrantGuard.allow?(amount)

    grant_credits!(amount, kind: "trial", expires_at: Billing::Catalog::CREDIT_LIFETIME.from_now)
    TrialGrantRecord.remember!(trial_identifiers)
    mark_trial_granted!
  end

  # 月に一度、少量だけ。来た人にしか配らないので、休眠アカウントには出ていかない
  def grant_monthly_free_credits!
    amount = Billing::Catalog::MONTHLY_FREE_CREDITS * Billing::POINTS_PER_CREDIT
    return if amount <= 0

    period_start = free_period_start
    return if credits_period_start && credits_period_start >= period_start
    return unless Billing::FreeGrantGuard.allow?(amount)

    grant_credits!(amount, kind: "monthly_free", expires_at: Billing::Catalog::CREDIT_LIFETIME.from_now)
    update_column(:credits_period_start, period_start) # rubocop:disable Rails/SkipsModelValidations
  end

  public

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
  def reset_subscription_credits!(amount, subscription: nil, stripe_event_id: nil, amount_cents: nil, currency: nil)
    with_lock do
      forfeited = subscription_credits
      if forfeited.positive?
        record_credit!(kind: "subscription_expire", delta: -forfeited, subscription:)
      end
      update!(subscription_credits: amount)
      # 解約時の失効（amount==0）では 0 デルタの付与ログを残さない。
      if amount.positive?
        record_credit!(kind: "subscription_grant", delta: amount, subscription:, stripe_event_id:, amount_cents:, currency:)
      end
    end
  end

  # Top-up（買い切り）クレジットを加算する。
  # 買い切りも期限付きで積む。
  # 以前は無期限の入れ物（topup_credits）に入れていたため、期限が効かなかった。
  # 既に入っているぶんはそのまま残し、消費順では最後に回る（＝先に期限付きが使われる）。
  def add_topup_credits!(amount, stripe_event_id: nil, amount_cents: nil, currency: nil)
    with_lock do
      credit_grants.create!(
        kind: "topup",
        amount_points: amount,
        remaining_points: amount,
        expires_at: Billing::Catalog::CREDIT_LIFETIME.from_now
      )
      record_credit!(kind: "topup_purchase", delta: amount, stripe_event_id:, amount_cents:, currency:)
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
  # 期限が近いものから使う。
  #
  # 以前は「グラント → 月額分 → 買い切り」の順だった。種類で決めていたため、
  # 月末で消える月額分より先に、まだ数ヶ月ある期限付きグラントを使ってしまい、
  # 結果として消えなくてよかったぶんを失っていた。
  #
  # 種類ではなく期限で並べる。期限が無いものは最後（いくらでも待てるため）。
  def consume_credits!(amount, item: nil, space_point_id: nil)
    with_lock do
      raise InsufficientCredits, "クレジットが不足しています" if available_credit_points < amount

      remaining = amount
      consumption_sources.each do |source|
        break if remaining <= 0

        take = [ source[:points], remaining ].min
        next if take <= 0

        source[:consume].call(take)
        remaining -= take
      end
      record_credit!(kind: "consumption", delta: -amount, item:, space_point_id:)
    end
  end

  # 使える残高を、期限が近い順に並べたもの。
  # 期限が無いものは nil を最後に置く（無期限のまま置いておいても失われないため）。
  def consumption_sources
    sources = credit_grants.active.map do |grant|
      {
        expires_at: grant.expires_at,
        points: grant.remaining_points,
        consume: ->(take) { grant.update!(remaining_points: grant.remaining_points - take) }
      }
    end

    if subscription_credits.positive?
      sources << {
        expires_at: subscription_expires_at,
        points: subscription_credits,
        consume: ->(take) { update!(subscription_credits: subscription_credits - take) }
      }
    end

    if topup_credits.positive?
      # 期限を持たない古い買い切り分。待てるので最後に回す
      sources << {
        expires_at: nil,
        points: topup_credits,
        consume: ->(take) { update!(topup_credits: topup_credits - take) }
      }
    end

    sources.sort_by { |source| [ source[:expires_at] ? 0 : 1, source[:expires_at] || Time.current ] }
  end

  # 月額プランのぶんが消えるとき。契約が無ければ無料枠の周期末
  def subscription_expires_at
    active_subscription&.current_period_end || next_free_credit_reset_at
  end

  # == クラスメソッド =========================================================
  # OAuthプロバイダーからユーザーを見出し作成
  # == 役割の判定 =============================================================
  # 環境変数の入口は「確認済みのアドレス」にだけ効かせる。
  # 未確認のうちから権限を持てると、アドレスを騙るだけで入れてしまうため。
  def bootstrap_owner?
    return false if confirmed_at.blank? || email.blank?

    self.class.bootstrap_owner_emails.include?(email.to_s.downcase)
  end

  def owner?
    role == "owner" || bootstrap_owner?
  end

  def admin?
    role == "admin" || owner?
  end

  # 表示・記録用の実効役割（環境変数由来の owner もそう見せる）
  def effective_role
    owner? ? "owner" : role
  end

  def self.bootstrap_owner_emails
    ENV.fetch("ADMIN_EMAILS", "").split(",").map { |email| email.strip.downcase }.reject(&:blank?)
  end

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
  def record_credit!(kind:, delta:, subscription: nil, item: nil, space_point_id: nil, stripe_event_id: nil,
                     amount_cents: nil, currency: nil)
    credit_transactions.create!(
      kind:,
      delta:,
      subscription:,
      item:,
      space_point_id:,
      stripe_event_id:,
      # 実際に支払われた金額。返金・売上の計算に要る（付与は支払いを伴わないので nil）
      amount_cents:,
      currency:,
      subscription_credits_after: subscription_credits,
      topup_credits_after: topup_credits
    )
  end
end
