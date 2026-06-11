class ItemTag < ApplicationRecord
  belongs_to :item
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :item_id }
end
