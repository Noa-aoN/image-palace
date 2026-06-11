class Collection < ApplicationRecord
  belongs_to :user
  has_many :collection_items, dependent: :destroy
  has_many :items, through: :collection_items
  has_many :room_collections, dependent: :destroy

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }
end
