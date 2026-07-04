class BoxItem < ApplicationRecord
  belongs_to :box
  belongs_to :item

  # 同一コレクションに同じアイテムを重複追加させない
  validates :item_id, uniqueness: { scope: :box_id }
end
