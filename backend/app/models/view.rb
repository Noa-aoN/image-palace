class View < ApplicationRecord
  self.table_name = "views"

  belongs_to :user
  has_many :collection_entries, as: :entry, dependent: :destroy

  NAME_MAX_LENGTH = 100
  # freeboard（フリーボード）。将来的にタイムライン等を追加する想定
  VIEW_TYPES = %w[freeboard].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :view_type, inclusion: { in: VIEW_TYPES }

  scope :recent, -> { order(created_at: :desc) }
end
