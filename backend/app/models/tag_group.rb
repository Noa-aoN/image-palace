class TagGroup < ApplicationRecord
  belongs_to :user
  has_many :tag_group_items, -> { order(Arel.sql("tag_group_items.position ASC NULLS LAST, tag_group_items.created_at")) },
           dependent: :destroy, inverse_of: :tag_group
  has_many :tags, through: :tag_group_items

  NAME_MAX_LENGTH = 50

  # プリセットグループの定義（seed とデフォルト識別に使う）。
  # tags は Tag::SCIENCE_DEFAULT_TAGS / NDC_DEFAULT_TAGS を参照して重複を避ける。
  DEFAULTS = [
    { key: "science", name: "科学分類（標準）", tag_names: Tag::SCIENCE_DEFAULT_TAGS },
    { key: "ndc", name: "NDC（図書館分類）", tag_names: Tag::NDC_DEFAULT_TAGS }
  ].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  # 並び順: ピン留め優先 → position → 名前。
  scope :ordered, -> { order(Arel.sql("tag_groups.pinned DESC, tag_groups.position ASC NULLS LAST, tag_groups.name")) }
end
