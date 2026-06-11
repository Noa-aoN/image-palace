class Collection < ApplicationRecord
  belongs_to :user
  # コレクションはカード/デッキ/スペース/ビューをまとめる汎用コンテナ（ポリモーフィック）
  has_many :collection_entries, dependent: :destroy
  # 旧: デッキ専用・カード直結。移行のため残置（UI 非公開）
  has_many :collection_decks, dependent: :destroy
  has_many :collection_items, dependent: :destroy
  has_many :room_collections, dependent: :destroy

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }
end
