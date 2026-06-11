class Collection < ApplicationRecord
  belongs_to :user
  # コレクションはデッキを束ねる。カード直結（collection_items）は移行のため残置し UI 非公開
  has_many :collection_decks, dependent: :destroy
  has_many :decks, through: :collection_decks
  has_many :collection_items, dependent: :destroy
  has_many :items, through: :collection_items
  has_many :room_collections, dependent: :destroy

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }
end
