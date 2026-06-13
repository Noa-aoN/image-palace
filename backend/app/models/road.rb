class Road < ApplicationRecord
  belongs_to :space
  has_many :road_points, dependent: :destroy

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :ordered, -> { order(Arel.sql("position IS NULL"), :position, :created_at) }
end
