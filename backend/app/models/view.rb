class View < ApplicationRecord
  self.table_name = "views"

  belongs_to :user
  has_many :collection_entries, as: :entry, dependent: :destroy
  has_many :view_items, dependent: :destroy
  has_many :items, through: :view_items

  NAME_MAX_LENGTH = 100
  # freeboard のみ実装済み。他は種別を仮置き（詳細画面は「準備中」表示）。
  VIEW_TYPES = %w[freeboard page map timeline binder album].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :view_type, inclusion: { in: VIEW_TYPES }

  scope :recent, -> { order(created_at: :desc) }
end
