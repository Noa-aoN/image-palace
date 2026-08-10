# frozen_string_literal: true

# 実績の定義。条件を満たすと、報酬（獲得物・クレジット）が配られる。
class AchievementDefinition < ApplicationRecord
  has_many :user_achievements, dependent: :destroy

  # 実績はすぐ増える。分類が無いと縦に長い1本の列になり、どこを見ればよいか分からない。
  # 並び順もここで決める（画面ごとに順番を持たない）
  CATEGORY_ORDER = %w[はじめに 作成 生成 学習 継続 整理 イベント].freeze

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :name, :condition_type, presence: true
  validates :condition_target, numericality: { only_integer: true, greater_than: 0 }
  validate :rewards_must_be_known

  scope :ordered, -> { order(:position, :created_at) }
  scope :active, -> { where(enabled: true) }

  # 初期の実績。報酬は RewardDefinition の key を指す
  BUILTINS = [
    { key: "first_card", name: "はじめてのカード", category: "はじめに", position: 10,
      description: "カードを1枚作る", condition_type: "cards_created", condition_target: 1,
      rewards: [ { "type" => "reward", "key" => "medal_first_card" },
                 { "type" => "reward", "key" => "title_traveler" },
                 { "type" => "reward", "key" => "treasure_seed" } ] },
    { key: "ten_cards", name: "10枚のカード", category: "作成", position: 11,
      description: "カードを10枚作る", condition_type: "cards_created", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "treasure_cup" } ] },
    { key: "fifty_cards", name: "50枚のカード", category: "作成", position: 12,
      description: "カードを50枚作る", condition_type: "cards_created", condition_target: 50,
      rewards: [ { "type" => "reward", "key" => "title_collector" } ] },
    { key: "hundred_cards", name: "100枚のカード", category: "作成", position: 13,
      description: "カードを100枚作る", condition_type: "cards_created", condition_target: 100,
      rewards: [ { "type" => "credits", "amount" => 3 } ] },
    # ここから先は年単位の到達点。品物はまだ用意していないので、当面はクレジットで報いる。
    # 段に見合う品物は、絵を用意してから管理画面で足す
    { key: "five_hundred_cards", name: "500枚のカード", category: "作成", position: 14,
      description: "カードを500枚作る", condition_type: "cards_created", condition_target: 500,
      rewards: [ { "type" => "reward", "key" => "medal_laurel" } ] },
    { key: "thousand_cards", name: "1000枚のカード", category: "作成", position: 15,
      description: "カードを1000枚作る", condition_type: "cards_created", condition_target: 1_000,
      rewards: [ { "type" => "credits", "amount" => 20 } ] },
    { key: "ten_thousand_cards", name: "10000枚のカード", category: "作成", position: 16,
      description: "カードを10000枚作る", condition_type: "cards_created", condition_target: 10_000,
      rewards: [ { "type" => "credits", "amount" => 100 } ] },
    { key: "ten_images", name: "10枚の絵", category: "生成", position: 20,
      description: "絵を10枚作る", condition_type: "images_generated", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "medal_creation_flame" } ] },
    { key: "thirty_images", name: "30枚の絵", category: "生成", position: 21,
      description: "絵を30枚作る", condition_type: "images_generated", condition_target: 30,
      rewards: [ { "type" => "reward", "key" => "title_visual_thinker" } ] },
    { key: "ten_reviews", name: "10回の学習", category: "学習", position: 30,
      description: "カードを10回見返す", condition_type: "reviews_total", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "title_apprentice" } ] },
    { key: "fifty_reviews", name: "50回の学習", category: "学習", position: 31,
      description: "カードを50回見返す", condition_type: "reviews_total", condition_target: 50,
      rewards: [ { "type" => "reward", "key" => "treasure_tablet" } ] },
    { key: "hundred_correct", name: "100問正解", category: "学習", position: 32,
      description: "100回正解する", condition_type: "reviews_correct", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => "treasure_book" } ] },
    { key: "streak_seven", name: "7日続ける", category: "継続", position: 40,
      description: "7日続けて学習する", condition_type: "streak_days", condition_target: 7,
      rewards: [ { "type" => "reward", "key" => "medal_streak_star" } ] },
    { key: "streak_fourteen", name: "14日続ける", category: "継続", position: 41,
      description: "14日続けて学習する", condition_type: "streak_days", condition_target: 14,
      rewards: [ { "type" => "reward", "key" => "treasure_laurel_pot" } ] },
    { key: "streak_hundred", name: "100日続ける", category: "継続", position: 42,
      description: "100日続けて学習する", condition_type: "streak_days", condition_target: 100,
      rewards: [ { "type" => "credits", "amount" => 30 } ] },
    { key: "active_year", name: "365日ぶんの学習", category: "継続", position: 43,
      description: "のべ365日学習する", condition_type: "active_days", condition_target: 365,
      rewards: [ { "type" => "credits", "amount" => 50 } ] },
    { key: "five_containers", name: "5つのまとまり", category: "整理", position: 50,
      description: "ボックス・キャンバス・スペースを合わせて5つ作る",
      condition_type: "containers_created", condition_target: 5,
      rewards: [ { "type" => "reward", "key" => "treasure_shelf" } ] }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    # 報酬が指す獲得物より先に作ると、参照先が無い状態ができる
    RewardDefinition.ensure_builtins!

    existing = where(key: BUILTIN_KEYS).pluck(:key).to_set
    BUILTINS.each do |attrs|
      next if existing.include?(attrs[:key])

      create!(attrs)
    rescue ActiveRecord::RecordNotUnique
      nil
    end
    @builtins_checked = true
  end

  def builtin?
    BUILTIN_KEYS.include?(key)
  end

  def available?(now = Time.current)
    return false unless enabled?
    return true unless limited?

    (starts_at.nil? || starts_at <= now) && (ends_at.nil? || ends_at > now)
  end

  private

  # 存在しない獲得物を指したまま保存できると、達成しても何も配られない
  def rewards_must_be_known
    Array(rewards).each do |reward|
      type = reward["type"]
      case type
      when "reward"
        next if RewardDefinition.exists?(key: reward["key"])

        errors.add(:rewards, "に無い獲得物が入っています（#{reward["key"]}）")
      when "credits"
        next if reward["amount"].to_i.positive?

        errors.add(:rewards, "のクレジットは1以上にしてください")
      else
        errors.add(:rewards, "に知らない種類が入っています（#{type}）")
      end
    end
  end
end
