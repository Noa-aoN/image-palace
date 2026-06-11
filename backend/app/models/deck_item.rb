class DeckItem < ApplicationRecord
  belongs_to :deck
  belongs_to :item

  validates :item_id, uniqueness: { scope: :deck_id }
end
