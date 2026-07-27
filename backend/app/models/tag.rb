class Tag < ApplicationRecord
  belongs_to :user
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags
  has_many :tag_group_items, dependent: :destroy
  has_many :tag_groups, through: :tag_group_items

  NAME_MAX_LENGTH = 50

  # デフォルト（プリセット）タグ。科学分類5 と NDC10 の2グループ分。
  # 自然科学/社会科学/芸術 は両グループに属する（タグ実体は1つ＝重複させない）。
  SCIENCE_DEFAULT_TAGS = %w[形式科学 自然科学 社会科学 人文科学 応用科学].freeze
  NDC_DEFAULT_TAGS = %w[総記 哲学 歴史 社会科学 自然科学 技術・工学 産業 芸術 言語 文学].freeze
  # 実際に seed する集合（重複排除）。配列順に position を振る。
  DEFAULT_TAGS = (SCIENCE_DEFAULT_TAGS + NDC_DEFAULT_TAGS).uniq.freeze

  # 既定タグ＝指定順、以降はピン留め優先・名前順。
  DEFAULT_ORDER = Arel.sql("tags.is_default DESC, tags.position ASC NULLS LAST, tags.pinned DESC, tags.name")

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  scope :ordered, -> { order(DEFAULT_ORDER) }

  # ユーザーにデフォルトタグとデフォルトグループ（科学分類/NDC）を付与する（冪等）。
  # 新規ユーザー作成時のみ自動実行され、既存ユーザーは rake tags:backfill_defaults で付与する。
  # ユーザーが編集・削除した既定グループ/タグは、通常運用（新規作成のみ）では復活しない。
  def self.assign_defaults_to(user)
    tags_by_name = assign_default_tags(user)
    assign_default_groups(user, tags_by_name)
  end

  # デフォルトタグを seed し、name => Tag のハッシュを返す。
  # 現行リストにある名前は is_default/position を設定し、リストから外れた旧デフォルトは
  # 通常タグ（is_default=false）へ戻す（タグ自体は削除しない）。
  def self.assign_default_tags(user)
    tags_by_name = {}
    DEFAULT_TAGS.each_with_index do |name, index|
      tag = user.tags.where("LOWER(name) = ?", name.downcase).first_or_initialize
      tag.name = name if tag.new_record?
      tag.is_default = true
      tag.position = index + 1
      tag.save!
      tags_by_name[name] = tag
    end
    # rubocop:disable Rails/SkipsModelValidations
    user.tags.where(is_default: true).where.not(name: DEFAULT_TAGS)
        .update_all(is_default: false, position: nil)
    # rubocop:enable Rails/SkipsModelValidations
    tags_by_name
  end

  # デフォルトグループ（科学分類/NDC）とそのメンバーシップを seed する（冪等）。
  # 既存グループ（同 default_key）は名前・位置を上書きしない（ユーザー編集を尊重）。
  def self.assign_default_groups(user, tags_by_name)
    TagGroup::DEFAULTS.each_with_index do |definition, group_index|
      group = user.tag_groups.where(default_key: definition[:key]).first_or_initialize
      if group.new_record?
        group.name = definition[:name]
        group.position = group_index + 1
      end
      group.is_default = true
      group.save!

      definition[:tag_names].each_with_index do |tag_name, item_index|
        tag = tags_by_name[tag_name]
        next if tag.nil?

        item = group.tag_group_items.where(tag_id: tag.id).first_or_initialize
        item.position = item_index + 1 if item.new_record?
        item.save!
      end
    end
  end
end
