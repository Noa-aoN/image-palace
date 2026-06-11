class RoomCollection < ApplicationRecord
  belongs_to :room
  belongs_to :collection

  validates :collection_id, uniqueness: { scope: :room_id }
end
