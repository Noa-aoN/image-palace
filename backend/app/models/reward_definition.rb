# frozen_string_literal: true

# 獲得物（称号・勲章・褒賞・表彰）の定義。
#
# 4種を1テーブルにしているのは、列の9割が同じで、管理画面・ギャラリー・通知・付与の
# 流れも同じだから。分けると同じ画面を4つ作ることになる。
# 違いは kind と「どこに出せるか」だけ。
#
# 組み込み（BUILTINS）は初回の読み出しで行として取り込む。以後は行が正。
# 消せないのは、コードや他の定義が key を参照しているため（止めたいときは無効にする）。
class RewardDefinition < ApplicationRecord
  KINDS = %w[title medal treasure honor].freeze
  KIND_LABELS = {
    "title" => "称号", "medal" => "勲章", "treasure" => "褒賞", "honor" => "表彰"
  }.freeze

  # レア度は9段階。九柱のムーサに対応させてある。
  # ただし**画面では5つに丸めて出す**。9段階をそのまま並べると、
  # 見る側は違いを覚えられず、ただ細かいだけになる。
  RARITY_LEVELS = (1..9).to_a.freeze
  RARITY_NAMES = {
    1 => "石", 2 => "青銅", 3 => "大理石", 4 => "銀", 5 => "金",
    6 => "瑠璃", 7 => "星", 8 => "神聖", 9 => "ムーサ"
  }.freeze

  # 画面で使う5つの段。枠の見た目はこちらで決める
  RARITY_TIERS = {
    1 => "stone", 2 => "stone", 3 => "stone",
    4 => "metal", 5 => "metal",
    6 => "jewel", 7 => "jewel",
    8 => "sacred", 9 => "muse"
  }.freeze

  # 差し替えられるようにするため、画像はファイルとして持つ。
  # 無い間は kind ごとの既定の絵柄（画面側）で出す
  has_one_attached :image
  has_many :user_rewards, dependent: :destroy

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :kind, inclusion: { in: KINDS }
  validates :rarity_level, inclusion: { in: RARITY_LEVELS }
  validates :name, presence: true
  validate :period_must_be_forward

  before_validation :apply_kind_defaults, on: :create

  scope :ordered, -> { order(:position, :created_at) }
  scope :of_kind, ->(kind) { where(kind: kind) }
  scope :active, -> { where(enabled: true) }

  # 初期の獲得物。判定できる条件だけで組んである
  # （カードの公開機能が無いため、公開系は入れていない）
  BUILTINS = [
    # ── 称号 ──
    { key: "title_traveler", kind: "title", name: "記憶の旅人", rarity_level: 2, category: "学習",
      description: "はじめの一歩を踏み出した人へ。", position: 10,
      metadata: { "motif" => "a traveler's marble stele with a small laurel sprig and a winding road relief" } },
    { key: "title_apprentice", kind: "title", name: "見習い学匠", rarity_level: 2, category: "学習",
      description: "繰り返し見返すことを覚えた人へ。", position: 11,
      metadata: { "motif" => "an apprentice scholar's stele with an open wax tablet and stylus relief" } },
    { key: "title_collector", kind: "title", name: "知識の蒐集家", rarity_level: 4, category: "創作",
      description: "多くのカードを集めた人へ。", position: 12,
      metadata: { "motif" => "a collector's stele with rows of small amphora relief and a laurel border" } },
    { key: "title_visual_thinker", kind: "title", name: "視覚思考家", rarity_level: 6, category: "創作",
      description: "絵で考えることを身につけた人へ。", position: 13,
      metadata: { "motif" => "a stele with an eye motif surrounded by geometric constellation lines" } },

    # ── 勲章 ──
    { key: "medal_first_card", kind: "medal", name: "初回作成の徽章", rarity_level: 2, category: "創作",
      description: "はじめてカードを作った証。", position: 20,
      metadata: { "motif" => "an eight-pointed star badge with a single small amphora at the center" } },
    { key: "medal_creation_flame", kind: "medal", name: "創作の火章", rarity_level: 4, category: "創作",
      description: "絵を作り続けた証。", position: 21,
      metadata: { "motif" => "a round medal with a stylized flame in an oil lamp at the center" } },
    { key: "medal_streak_star", kind: "medal", name: "7日継続の星章", rarity_level: 4, category: "継続",
      description: "7日続けた証。", position: 22,
      metadata: { "motif" => "a seven-pointed star badge with a laurel ring at the center" } },
    { key: "medal_laurel", kind: "medal", name: "蒐集の月桂冠", rarity_level: 8, category: "創作",
      description: "100枚のカードを積み上げた証。", position: 23,
      metadata: { "motif" => "a full laurel wreath crown shaped as a circular medal" } },

    # ── 褒賞 ──
    { key: "treasure_seed", kind: "treasure", name: "記憶の種", rarity_level: 2, category: "学習",
      description: "すべてはここから。", position: 30,
      metadata: { "motif" => "a small clay pot holding a single sprouting seed" } },
    { key: "treasure_tablet", kind: "treasure", name: "小さな石板", rarity_level: 2, category: "学習",
      description: "積み重ねた学習の記録。", position: 31,
      metadata: { "motif" => "a small stone tablet with faint carved grid lines" } },
    { key: "treasure_cup", kind: "treasure", name: "青銅の小杯", rarity_level: 4, category: "創作",
      description: "10枚のカードを作った褒賞。", position: 32,
      metadata: { "motif" => "a small two-handled bronze drinking cup (kylix)" } },
    { key: "treasure_book", kind: "treasure", name: "学匠の書籍", rarity_level: 4, category: "学習",
      description: "正しく答え続けた褒賞。", position: 33,
      metadata: { "motif" => "a bound codex with a leather strap and a laurel emblem" } },
    { key: "treasure_laurel_pot", kind: "treasure", name: "月桂樹の鉢植え", rarity_level: 6, category: "継続",
      description: "長く続けた人の部屋に。", position: 34,
      metadata: { "motif" => "a terracotta pot with a young laurel tree" } },
    { key: "treasure_shelf", kind: "treasure", name: "小さな本棚", rarity_level: 4, category: "整理",
      description: "まとめる力の褒賞。", position: 35,
      metadata: { "motif" => "a small wooden shelf holding rolled scrolls" } },

    # ── 表彰（手動付与のみ。条件では配らない） ──
    { key: "honor_beta", kind: "honor", name: "β参加者", rarity_level: 6, category: "公式",
      description: "初期からこの場所を見てくれた人へ。", position: 40,
      metadata: { "motif" => "an award plaque with an olive branch and a small owl" } },
    { key: "honor_supporter", kind: "honor", name: "初期支援者", rarity_level: 8, category: "公式",
      description: "早くから支えてくれた人へ。", position: 41,
      metadata: { "motif" => "an award plaque with a torch and a laurel wreath" } },
    { key: "honor_featured", kind: "honor", name: "公式推薦", rarity_level: 8, category: "公式",
      description: "運営が選んだ作り手へ。", position: 42,
      metadata: { "motif" => "an award plaque with a sunburst and a laurel wreath" } }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  # 足りない組み込みだけ入れる。既にある行は触らない（運営が変えた値を戻さない）
  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

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

  def kind_label
    KIND_LABELS[kind]
  end

  def rarity_name
    RARITY_NAMES[rarity_level]
  end

  # 枠の見た目に使う段。画面はこれだけを見る
  def rarity_tier
    RARITY_TIERS[rarity_level] || "stone"
  end

  # いま配ってよいか（止めていない・期間内）
  def grantable?(now = Time.current)
    return false unless enabled?
    return true unless limited?

    (starts_at.nil? || starts_at <= now) && (ends_at.nil? || ends_at > now)
  end

  private

  # どこに出せるかは種類でほぼ決まる。作るたびに選ばせるより、
  # 既定を入れておいて、変えたい人だけ変えるほうがよい
  def apply_kind_defaults
    self.equippable = kind == "title" if equippable.nil? || !equippable
    self.featurable = kind == "medal" if featurable.nil? || !featurable
    self.room_displayable = %w[treasure honor].include?(kind) if room_displayable.nil? || !room_displayable
  end

  def period_must_be_forward
    return if starts_at.blank? || ends_at.blank? || starts_at < ends_at

    errors.add(:ends_at, "は開始より後にしてください")
  end
end
