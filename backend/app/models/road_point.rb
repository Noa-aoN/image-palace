class RoadPoint < ApplicationRecord
  belongs_to :road
  # 空ポイントを許容（カード未割当）
  belongs_to :item, optional: true

  validates :position, presence: true, numericality: { only_integer: true }

  scope :ordered, -> { order(:position, :created_at) }
end
