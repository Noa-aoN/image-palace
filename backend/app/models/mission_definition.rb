# frozen_string_literal: true

# ミッションの定義。「これから取れるもの」を出すためのもので、
# 実績（積み上がったものを見る）と役割を分けている。
class MissionDefinition < ApplicationRecord
  CADENCES = %w[daily weekly onboarding limited event].freeze
  CADENCE_LABELS = {
    "daily" => "今日", "weekly" => "今週", "onboarding" => "はじめに",
    "limited" => "期間限定", "event" => "イベント"
  }.freeze

  has_many :user_missions, dependent: :destroy
  # 単発のミッションは series を持たない
  belongs_to :mission_series, optional: true

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :name, :condition_type, presence: true
  # 知らない条件はいつまでも達成にならない（数える手立てが無い）。作る時点で弾く。
  # 既にある行は触らない
  validate :condition_type_must_be_known, on: :create
  validates :cadence, inclusion: { in: CADENCES }
  validates :condition_target, numericality: { only_integer: true, greater_than: 0 }

  scope :ordered, -> { order(:position, :created_at) }
  scope :active, -> { where(enabled: true) }

  BUILTINS = [
    { key: "start_first_card", name: "最初のカードを作る", cadence: "onboarding", position: 10,
      description: "1枚作ってみましょう。", condition_type: "cards_created", condition_target: 1 },
    { key: "start_first_image", name: "最初の絵を生成する", cadence: "onboarding", position: 11,
      description: "言葉が絵になります。", condition_type: "images_generated", condition_target: 1 },
    { key: "start_first_container", name: "ボックスを1つ作る", cadence: "onboarding", position: 12,
      description: "カードをまとめる場所を作ります。", condition_type: "containers_created", condition_target: 1 },
    { key: "start_streak_three", name: "3日続けて使う", cadence: "onboarding", position: 13,
      description: "続けるほど覚えます。", condition_type: "streak_days", condition_target: 3 },
    # コア機能ではないが、宮殿の主人の顔が決まると自分の場所という感じが出る。
    # 段のある道のりには入れず、はじめの単発として置く
    { key: "start_avatar", name: "自分の絵を決める", cadence: "onboarding", position: 14,
      description: "宮殿の主人の顔になります。",
      condition_type: "avatar_set", condition_target: 1 },
    { key: "daily_one_review", name: "今日カードを1回見返す", cadence: "daily", position: 20,
      description: "1回でも見返せば達成です。", condition_type: "reviews_total", condition_target: 1 },
    # ── シリーズ「宮殿を建てる」──
    # 段は一度きりなので cadence は onboarding（繰り返さない側）に置く。
    # series_key は BUILTINS だけの目印で、列ではない（作るときに id へ引き当てる）
    { key: "palace_ten_cards", name: "カードを10枚そろえる", cadence: "onboarding",
      series_key: "build_palace", series_step: 1, position: 100,
      description: "まずは10枚。", condition_type: "cards_created", condition_target: 10,
      rewards: [ { "type" => "credits", "amount" => 1 } ] },
    { key: "palace_three_containers", name: "しまう場所を3つ作る", cadence: "onboarding",
      series_key: "build_palace", series_step: 2, position: 101,
      description: "ボックス・キャンバス・スペースを合わせて3つ。",
      condition_type: "containers_created", condition_target: 3,
      rewards: [ { "type" => "credits", "amount" => 1 } ] },
    { key: "palace_fifty_reviews", name: "50回見返す", cadence: "onboarding",
      series_key: "build_palace", series_step: 3, position: 102,
      description: "作るだけでなく、思い出すところまで。",
      condition_type: "reviews_total", condition_target: 50,
      rewards: [ { "type" => "credits", "amount" => 2 } ] },
    { key: "palace_thirty_streak", name: "30日続ける", cadence: "onboarding",
      series_key: "build_palace", series_step: 4, position: 103,
      description: "ここまで来れば、宮殿は住まいになります。",
      condition_type: "streak_days", condition_target: 30,
      # 最後の段に見合う品物はまだ用意していない（絵から作る必要がある）。
      # 当面はクレジットで報い、品ができたら管理画面で差し替える
      rewards: [ { "type" => "credits", "amount" => 5 } ] },
    # ── シリーズ「記憶を鍛える」──
    # 作る側（宮殿を建てる）と対になる、思い出す側の道
    { key: "memory_first_review", name: "はじめて見返す", cadence: "onboarding",
      series_key: "train_memory", series_step: 1, position: 110,
      description: "作ったカードを1回見返します。", condition_type: "reviews_total", condition_target: 1,
      rewards: [ { "type" => "credits", "amount" => 1 } ] },
    { key: "memory_hundred_reviews", name: "100回見返す", cadence: "onboarding",
      series_key: "train_memory", series_step: 2, position: 111,
      description: "回数が増えるほど、思い出すのが速くなります。",
      condition_type: "reviews_total", condition_target: 100,
      rewards: [ { "type" => "credits", "amount" => 2 } ] },
    { key: "memory_three_hundred_correct", name: "300問正解する", cadence: "onboarding",
      series_key: "train_memory", series_step: 3, position: 112,
      description: "見返すだけでなく、当てられるところまで。",
      condition_type: "reviews_correct", condition_target: 300,
      rewards: [ { "type" => "credits", "amount" => 3 } ] },
    { key: "memory_thousand_reviews", name: "1000回見返す", cadence: "onboarding",
      series_key: "train_memory", series_step: 4, position: 113,
      description: "ここまで来ると、覚えたことは自分のものになっています。",
      condition_type: "reviews_total", condition_target: 1_000,
      rewards: [ { "type" => "credits", "amount" => 10 } ] },
    # ── シリーズ「通い続ける」──
    # 続けた日数だけが積み上がる。作った量でも正解数でも埋められない道
    { key: "visit_seven_days", name: "7日続ける", cadence: "onboarding",
      series_key: "keep_visiting", series_step: 1, position: 120,
      description: "まずは1週間。", condition_type: "streak_days", condition_target: 7,
      rewards: [ { "type" => "credits", "amount" => 1 } ] },
    { key: "visit_thirty_active", name: "30日おとずれる", cadence: "onboarding",
      series_key: "keep_visiting", series_step: 2, position: 121,
      description: "続けて来なくても構いません。来た日を数えます。",
      condition_type: "active_days", condition_target: 30,
      rewards: [ { "type" => "credits", "amount" => 3 } ] },
    { key: "visit_hundred_days", name: "100日続ける", cadence: "onboarding",
      series_key: "keep_visiting", series_step: 3, position: 122,
      description: "宮殿に住んでいると言える日数です。",
      condition_type: "streak_days", condition_target: 100,
      rewards: [ { "type" => "credits", "amount" => 10 } ] }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    existing = where(key: BUILTIN_KEYS).pluck(:key).to_set
    series_ids = MissionSeries.registry.to_h { |s| [ s.key, s.id ] }
    BUILTINS.each do |attrs|
      next if existing.include?(attrs[:key])

      # series_key は BUILTINS の中だけの目印。行を作るときに id へ引き当てる
      row = attrs.except(:series_key)
      row[:mission_series_id] = series_ids[attrs[:series_key]] if attrs[:series_key]
      create!(row)
    rescue ActiveRecord::RecordNotUnique
      nil
    end
    @builtins_checked = true
  end

  def builtin?
    BUILTIN_KEYS.include?(key)
  end

  def cadence_label
    CADENCE_LABELS[cadence]
  end

  def available?(now = Time.current)
    return false unless enabled?

    (starts_at.nil? || starts_at <= now) && (ends_at.nil? || ends_at > now)
  end

  # 繰り返すものは期間ごとに別の行になる。
  # これを鍵に混ぜることで、毎日全員ぶんの行を作り直すリセット処理が要らなくなる
  def period_key(now = Time.current)
    case cadence
    when "daily" then now.to_date.to_s
    when "weekly" then now.strftime("%G-W%V")
    else "-"
    end
  end

  # 進捗の起点。今日ぶん・今週ぶんは、その期間に入ってからの数を見る
  def counted_since(now = Time.current)
    case cadence
    when "daily" then now.beginning_of_day
    when "weekly" then now.beginning_of_week
    end
  end

  private

  def condition_type_must_be_known
    return if condition_type.blank?
    return if ::Achievements::Conditions.known?(condition_type)

    errors.add(:condition_type, "は数える手立てがありません（#{condition_type}）")
  end
end
