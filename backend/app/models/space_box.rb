class SpaceBox < ApplicationRecord
  belongs_to :space
  belongs_to :box

  validates :box_id, uniqueness: { scope: :space_id }
end
