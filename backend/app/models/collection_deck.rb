class CollectionDeck < ApplicationRecord
  belongs_to :collection
  belongs_to :deck

  validates :deck_id, uniqueness: { scope: :collection_id }
end
