class SpacePoint < ApplicationRecord
  belongs_to :space
  # 空ポイントを許容（カード未割当）
  belongs_to :item, optional: true

  validates :position, presence: true, numericality: { only_integer: true }

  scope :ordered, -> { order(:position, :created_at) }
end
