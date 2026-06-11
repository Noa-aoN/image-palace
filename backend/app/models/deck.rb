class Deck < ApplicationRecord
  belongs_to :user
  belongs_to :cover_item, class_name: "Item", optional: true
  has_many :deck_items, dependent: :destroy
  has_many :items, through: :deck_items

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }

  # 表紙カード（未指定ならデッキに最初に追加したカードを使う）
  def cover
    cover_item || items.order(Arel.sql("deck_items.created_at ASC")).first
  end
end
