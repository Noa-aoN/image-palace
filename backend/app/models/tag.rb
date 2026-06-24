class Tag < ApplicationRecord
  belongs_to :user
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags

  NAME_MAX_LENGTH = 50

  # デフォルト（プリセット）タグ。科学分類5 と NDC10 の2グループ。
  # 自然科学/社会科学/芸術 は両グループに属する（タグ実体は1つ＝重複させない）。
  SCIENCE_DEFAULT_TAGS = %w[形式科学 自然科学 社会科学 人文科学 応用科学].freeze
  NDC_DEFAULT_TAGS = %w[総記 哲学 歴史 社会科学 自然科学 技術・工学 産業 芸術 言語 文学].freeze
  # 実際に seed する集合（重複排除）。配列順に position を振る。
  DEFAULT_TAGS = (SCIENCE_DEFAULT_TAGS + NDC_DEFAULT_TAGS).uniq.freeze

  # タグが属するデフォルトグループ（["main"], ["ndc"], ["main","ndc"]）。
  def self.default_groups(name)
    groups = []
    groups << "main" if SCIENCE_DEFAULT_TAGS.include?(name)
    groups << "ndc" if NDC_DEFAULT_TAGS.include?(name)
    groups
  end

  # 既定タグ＝指定順、以降はピン留め優先・名前順。
  DEFAULT_ORDER = Arel.sql("tags.is_default DESC, tags.position ASC NULLS LAST, tags.pinned DESC, tags.name")

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  scope :ordered, -> { order(DEFAULT_ORDER) }

  # ユーザーにデフォルトタグを付与する（冪等）。
  # 現行リストにある名前は is_default/position を設定し、リストから外れた旧デフォルトは
  # 通常タグ（is_default=false）へ戻す（タグ自体は削除しない）。
  def self.assign_defaults_to(user)
    DEFAULT_TAGS.each_with_index do |name, index|
      tag = user.tags.where("LOWER(name) = ?", name.downcase).first_or_initialize
      tag.name = name if tag.new_record?
      tag.is_default = true
      tag.position = index + 1
      tag.save!
    end
    # rubocop:disable Rails/SkipsModelValidations
    user.tags.where(is_default: true).where.not(name: DEFAULT_TAGS)
        .update_all(is_default: false, position: nil)
    # rubocop:enable Rails/SkipsModelValidations
  end
end
