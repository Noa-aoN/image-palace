class SpaceCollection < ApplicationRecord
  belongs_to :space
  belongs_to :collection

  validates :collection_id, uniqueness: { scope: :space_id }
end
