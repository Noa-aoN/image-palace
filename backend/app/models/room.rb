class Room < ApplicationRecord
  belongs_to :space
  has_many :room_collections, dependent: :destroy
  has_many :collections, through: :room_collections

  NAME_MAX_LENGTH = 100
  # 将来的にボード等を追加する想定。現状は shelf（棚）のみ
  LAYOUT_TYPES = %w[shelf].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :layout_type, inclusion: { in: LAYOUT_TYPES }

  scope :ordered, -> { order(Arel.sql("position IS NULL"), :position, :created_at) }
end
