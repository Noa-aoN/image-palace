class Tag < ApplicationRecord
  belongs_to :user
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags

  NAME_MAX_LENGTH = 50

  # 各ユーザーに初期付与するデフォルト（プリセット）タグ。配列順に position を振る。
  # メイン＝科学5分類＋芸術・創作／実用・生活／その他（8個）。
  MAIN_DEFAULT_TAGS = %w[形式科学 自然科学 社会科学 人文科学 応用科学 芸術・創作 実用・生活 その他].freeze
  # NDC 補完（メインと同名・カバー済み＝自然科学/社会科学/芸術 は除外した7個）。
  NDC_DEFAULT_TAGS = %w[総記 哲学 歴史 技術・工学 産業 言語 文学].freeze
  DEFAULT_TAGS = (MAIN_DEFAULT_TAGS + NDC_DEFAULT_TAGS).freeze

  # デフォルトタグの種別を返す（"main" / "ndc" / nil）。
  def self.default_kind(name)
    if MAIN_DEFAULT_TAGS.include?(name)
      "main"
    elsif NDC_DEFAULT_TAGS.include?(name)
      "ndc"
    end
  end

  # 既定タグ＝指定順、以降はピン留め優先・名前順。
  DEFAULT_ORDER = Arel.sql("tags.is_default DESC, tags.position ASC NULLS LAST, tags.pinned DESC, tags.name")

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  scope :ordered, -> { order(DEFAULT_ORDER) }

  # ユーザーにデフォルトタグを付与する（冪等：同名があれば is_default/position を更新）。
  def self.assign_defaults_to(user)
    DEFAULT_TAGS.each_with_index do |name, index|
      tag = user.tags.where("LOWER(name) = ?", name.downcase).first_or_initialize
      tag.name = name if tag.new_record?
      tag.is_default = true
      tag.position = index + 1
      tag.save!
    end
  end
end
