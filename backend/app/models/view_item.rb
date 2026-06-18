class ViewItem < ApplicationRecord
  belongs_to :view
  belongs_to :item
  # space_map 種別: カードを置いたスペースのポイント（freeboard では nil）
  belongs_to :space_point, optional: true

  validates :item_id, uniqueness: { scope: :view_id }
  # space_map では 1 ポイント 1 カード
  validates :space_point_id, uniqueness: { scope: :view_id }, allow_nil: true
  validates :x, :y, presence: true, numericality: true
  validates :z_index, presence: true, numericality: { only_integer: true }
end
