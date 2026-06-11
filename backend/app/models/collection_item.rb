class CollectionItem < ApplicationRecord
  belongs_to :collection
  belongs_to :item

  # 同一コレクションに同じアイテムを重複追加させない
  validates :item_id, uniqueness: { scope: :collection_id }
end
