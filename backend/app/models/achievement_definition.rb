# frozen_string_literal: true

# 実績の定義。条件を満たすと、報酬（獲得物・クレジット）が配られる。
class AchievementDefinition < ApplicationRecord
  include DefinitionRegistry

  include RewardsValidation

  has_many :user_achievements, dependent: :destroy

  # 実績はすぐ増える。分類が無いと縦に長い1本の列になり、どこを見ればよいか分からない。
  # 並び順もここで決める（画面ごとに順番を持たない）
  CATEGORY_ORDER = %w[はじめに 作成 生成 学習 継続 整理 イベント].freeze

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :name, :condition_type, presence: true
  # 知らない条件は**いつまでも達成にならない**（数える手立てが無く、常に 0 のまま）。
  # 運営が画面から作るときに気づけるよう、作る時点で弾く。
  # 既にある行は触らない（組み込みを後から足すときに、古い行が落ちないように）
  validate :condition_type_must_be_known, on: :create
  validates :condition_target, numericality: { only_integer: true, greater_than: 0 }
  # 報酬の検証は RewardsValidation（ミッションと共通）

  scope :ordered, -> { order(:position, :created_at) }
  scope :active, -> { where(enabled: true) }

  # 初期の実績。報酬は RewardDefinition の key を指す
  BUILTINS = [
    { key: "first_card", name: "はじめてのカード", category: "はじめに", position: 10,
      description: "カードを1枚作る", condition_type: "cards_created", condition_target: 1,
      rewards: [ { "type" => "reward", "key" => "medal_first_card" },
                 { "type" => "reward", "key" => "title_traveler" },
                 { "type" => "reward", "key" => "treasure_seed" } ] },
    # 集めることと**出すこと**は別の行い。
    # 星を押して初めて名乗り・宮殿に出るのに、押さないまま気づかない人が多い。
    #
    # ミッションではなく実績に置く。ミッションの「はじめに」は表示数に上限があり、
    # ここを足すと最初の一歩（カードを作る）が押し出される。
    # それに、獲得物を持つまで進めようがないので「はじめの手順」でもない。
    { key: "first_title_showcase", name: "はじめての名乗り", category: "はじめに", position: 16,
      description: "手に入れた称号を名乗る", condition_type: "title_showcased", condition_target: 1 },
    { key: "first_medal_showcase", name: "はじめての掲揚", category: "はじめに", position: 17,
      description: "手に入れた勲章を掲げる", condition_type: "medal_showcased", condition_target: 1 },
    { key: "first_treasure_showcase", name: "はじめての飾りつけ", category: "はじめに", position: 18,
      description: "手に入れた宝物を部屋に飾る", condition_type: "treasure_showcased", condition_target: 1 },
    { key: "ten_cards", name: "10枚のカード", category: "作成", position: 11,
      description: "カードを10枚作る", condition_type: "cards_created", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "treasure_cup" } ] },
    { key: "fifty_cards", name: "50枚のカード", category: "作成", position: 12,
      description: "カードを50枚作る", condition_type: "cards_created", condition_target: 50,
      rewards: [ { "type" => "reward", "key" => "title_collector" } ] },
    { key: "hundred_cards", name: "100枚のカード", category: "作成", position: 13,
      description: "カードを100枚作る", condition_type: "cards_created", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => "medal_laurel" } ] },
    { key: "five_hundred_cards", name: "500枚のカード", category: "作成", position: 14,
      description: "カードを500枚作る", condition_type: "cards_created", condition_target: 500,
      rewards: [ { "type" => "reward", "key" => "title_archivist" } ] },
    # ここから先だけクレジットで報いる。**カードを作るにはクレジットが要る**ので、
    # ここに立っている人は、その枚数ぶんを既に払っている。返すのはその一部（1%以下）。
    # 見返す・続ける・集めるといった、払わずに届く到達点には出さない（CREDIT_BACKED_CONDITIONS）
    { key: "thousand_cards", name: "1000枚のカード", category: "作成", position: 15,
      description: "カードを1000枚作る", condition_type: "cards_created", condition_target: 1_000,
      rewards: [ { "type" => "credits", "amount" => 10 } ] },
    { key: "ten_thousand_cards", name: "10000枚のカード", category: "作成", position: 16,
      description: "カードを10000枚作る", condition_type: "cards_created", condition_target: 10_000,
      rewards: [ { "type" => "credits", "amount" => 50 } ] },
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
      rewards: [ { "type" => "reward", "key" => "medal_century_streak" } ] },
    { key: "active_year", name: "365日ぶんの学習", category: "継続", position: 43,
      description: "のべ365日学習する", condition_type: "active_days", condition_target: 365,
      rewards: [ { "type" => "reward", "key" => "treasure_laurel_crown" } ] },
    { key: "five_containers", name: "5つのまとまり", category: "整理", position: 50,
      description: "ボックス・キャンバス・スペースを合わせて5つ作る",
      condition_type: "containers_created", condition_target: 5,
      rewards: [ { "type" => "reward", "key" => "treasure_shelf" } ] },
    # ── 追加分。増やした獲得物の配り先 ──
    { key: "first_container", name: "はじめてのまとまり", category: "はじめに", position: 17,
      description: "ボックス・キャンバス・スペースのどれかを1つ作る",
      condition_type: "containers_created", condition_target: 1,
      rewards: [ { "type" => "reward", "key" => "medal_first_shelf" } ] },
    { key: "twenty_containers", name: "20のまとまり", category: "整理", position: 51,
      description: "まとまりを20作る", condition_type: "containers_created", condition_target: 20,
      rewards: [ { "type" => "reward", "key" => "title_scribe" },
                 { "type" => "reward", "key" => "treasure_scroll" } ] },
    { key: "twenty_correct", name: "20問正解", category: "学習", position: 33,
      description: "20回正解する", condition_type: "reviews_correct", condition_target: 20,
      rewards: [ { "type" => "reward", "key" => "medal_quiz" } ] },
    { key: "five_hundred_reviews", name: "500回の学習", category: "学習", position: 34,
      description: "カードを500回見返す", condition_type: "reviews_total", condition_target: 500,
      rewards: [ { "type" => "reward", "key" => "title_mnemonist" },
                 { "type" => "reward", "key" => "treasure_key" } ] },
    { key: "thousand_correct", name: "1000問正解", category: "学習", position: 35,
      description: "1000回正解する", condition_type: "reviews_correct", condition_target: 1_000,
      rewards: [ { "type" => "reward", "key" => "treasure_star_map" } ] },
    { key: "streak_thirty", name: "30日続ける", category: "継続", position: 44,
      description: "30日続けて学習する", condition_type: "streak_days", condition_target: 30,
      rewards: [ { "type" => "reward", "key" => "medal_month" },
                 { "type" => "reward", "key" => "treasure_lamp" } ] },
    { key: "active_hundred", name: "100日ぶんの学習", category: "継続", position: 45,
      description: "のべ100日学習する", condition_type: "active_days", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => "title_keeper" } ] },
    { key: "active_year_medal", name: "1年ぶんの歩み", category: "継続", position: 46,
      description: "のべ365日学習する", condition_type: "active_days", condition_target: 365,
      rewards: [ { "type" => "reward", "key" => "medal_year" } ] },
    { key: "fifty_images", name: "50枚の絵", category: "生成", position: 22,
      description: "絵を50枚作る", condition_type: "images_generated", condition_target: 50,
      rewards: [ { "type" => "reward", "key" => "treasure_lyre" } ] },
    { key: "three_hundred_images", name: "300枚の絵", category: "生成", position: 23,
      description: "絵を300枚作る", condition_type: "images_generated", condition_target: 300,
      rewards: [ { "type" => "reward", "key" => "treasure_statuette" } ] },
    { key: "collector_ten", name: "10個の獲得", category: "はじめに", position: 18,
      description: "獲得物を10個集める", condition_type: "rewards_earned", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "medal_collector" } ] },
    { key: "collector_thirty", name: "30個の獲得", category: "整理", position: 52,
      description: "獲得物を30個集める", condition_type: "rewards_earned", condition_target: 30,
      rewards: [ { "type" => "reward", "key" => "treasure_trophy" } ] },

    # ── ここから追加分。**新しい獲得物に、配る道を用意する** ──
    # 目標値は既にある実績と重ならないものを選んである
    # （同じ数で2つ達成すると、どちらが何で開いたのか分からない）
    { key: "twenty_cards", name: "20枚のカード", category: "作成", position: 14,
      description: "カードを20枚作る", condition_type: "cards_created", condition_target: 20,
      rewards: [ { "type" => "reward", "key" => "treasure_amphora" } ] },
    { key: "two_hundred_cards", name: "200枚のカード", category: "作成", position: 15,
      description: "カードを200枚作る", condition_type: "cards_created", condition_target: 200,
      rewards: [ { "type" => "reward", "key" => "medal_two_hundred" } ] },
    { key: "twenty_images", name: "20枚の絵", category: "生成", position: 23,
      description: "絵を20枚作る", condition_type: "images_generated", condition_target: 20,
      rewards: [ { "type" => "reward", "key" => "title_illustrator" } ] },
    { key: "hundred_images", name: "100枚の絵", category: "生成", position: 24,
      description: "絵を100枚作る", condition_type: "images_generated", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => "treasure_mask" } ] },
    { key: "first_review", name: "はじめての見返し", category: "はじめに", position: 16,
      description: "カードを1回見返す", condition_type: "reviews_total", condition_target: 1,
      rewards: [ { "type" => "reward", "key" => "medal_first_review" } ] },
    { key: "hundred_reviews", name: "100回の見返し", category: "学習", position: 34,
      description: "カードを100回見返す", condition_type: "reviews_total", condition_target: 100,
      rewards: [ { "type" => "reward", "key" => "medal_reviews_hundred" } ] },
    { key: "correct_five_hundred", name: "500回の正解", category: "学習", position: 35,
      description: "500回正解する", condition_type: "reviews_correct", condition_target: 500,
      rewards: [ { "type" => "reward", "key" => "treasure_owl" } ] },
    { key: "correct_three_thousand", name: "3000回の正解", category: "学習", position: 36,
      description: "3000回正解する", condition_type: "reviews_correct", condition_target: 3_000,
      rewards: [ { "type" => "reward", "key" => "title_sage" } ] },
    # まとまりを10作ると3つ配る。**同じ節目で種別を揃えて渡す**と、
    # 記名板が一度に埋まって、集めている実感が出る
    { key: "ten_containers", name: "10のまとまり", category: "整理", position: 53,
      description: "ボックス・キャンバス・スペースを合わせて10作る",
      condition_type: "containers_created", condition_target: 10,
      rewards: [ { "type" => "reward", "key" => "title_curator" },
                 { "type" => "reward", "key" => "medal_space" },
                 { "type" => "reward", "key" => "treasure_compass" } ] },
    { key: "fifty_containers", name: "50のまとまり", category: "整理", position: 54,
      description: "ボックス・キャンバス・スペースを合わせて50作る",
      condition_type: "containers_created", condition_target: 50,
      rewards: [ { "type" => "reward", "key" => "title_architect" } ] },
    { key: "streak_twentyone", name: "21日連続", category: "継続", position: 47,
      description: "21日続けて学習する", condition_type: "streak_days", condition_target: 21,
      rewards: [ { "type" => "reward", "key" => "treasure_hourglass" } ] },
    { key: "streak_sixty", name: "60日連続", category: "継続", position: 48,
      description: "60日続けて学習する", condition_type: "streak_days", condition_target: 60,
      rewards: [ { "type" => "reward", "key" => "title_disciplined" } ] }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    # 報酬が指す獲得物より先に作ると、参照先が無い状態ができる
    RewardDefinition.ensure_builtins!

    existing = where(key: BUILTIN_KEYS).index_by(&:key)
    BUILTINS.each do |attrs|
      row = existing[attrs[:key]]
      if row.nil?
        create!(attrs)
      else
        sync_rewards!(row, attrs[:rewards])
      end
    rescue ActiveRecord::RecordNotUnique
      nil
    end
    @builtins_checked = true
  end

  # 報酬だけはコードを正本にして、既にある行にも書き戻す。
  #
  # ここを「作るときだけ」にしていたため、先に作られた行がコードと食い違ったまま
  # 本番で動いていた（実績「100枚のカード」がコードでは 3cr、本番では勲章）。
  # 画面から報酬を変える口は無いので、上書きで消える運営の設定も無い。
  #
  # 報酬は原価に直結する。**テストで守れる場所（コード）に一本化する**。
  def self.sync_rewards!(row, rewards)
    desired = Array(rewards).map(&:stringify_keys)
    return if row.rewards.to_a.map(&:stringify_keys) == desired

    row.update_columns(rewards: desired) # rubocop:disable Rails/SkipsModelValidations
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

  private

  def condition_type_must_be_known
    return if condition_type.blank?
    return if ::Achievements::Conditions.known?(condition_type)

    errors.add(:condition_type, "は数える手立てがありません（#{condition_type}）")
  end
end
