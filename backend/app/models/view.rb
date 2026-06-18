class View < ApplicationRecord
  self.table_name = "views"

  belongs_to :user
  # space_map 種別: 配置先のスペース（作成済みの road/room）
  belongs_to :space, optional: true
  has_many :collection_entries, as: :entry, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :items, through: :view_items

  NAME_MAX_LENGTH = 100
  # freeboard と space_map を実装済み。他は種別を仮置き（詳細画面は「準備中」表示）。
  VIEW_TYPES = %w[freeboard space_map page map timeline binder album].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :view_type, inclusion: { in: VIEW_TYPES }
  # スペースマッピングは配置先スペース必須。指定スペースは本人所有であること。
  validates :space_id, presence: true, if: -> { view_type == "space_map" }
  validate :space_must_belong_to_user, if: -> { space_id.present? }

  scope :recent, -> { order(created_at: :desc) }

  def space_map?
    view_type == "space_map"
  end

  private

  def space_must_belong_to_user
    return if user && user.spaces.exists?(id: space_id)

    errors.add(:space, "が見つかりません")
  end
end
