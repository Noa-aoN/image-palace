class User < ApplicationRecord
  # == Deviseモジュール ======================================================
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable,
         :omniauthable, omniauth_providers: [ :google_oauth2 ]

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

  # 当月の生成数。カード（items）と、名前付きスペースポイント（画像生成を伴う）を
  # 合算して数える。月間生成上限（月100枚）は両者で共有する。
  def monthly_generation_count
    items.created_this_month.count + space_points.named.created_this_month.count
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
end
