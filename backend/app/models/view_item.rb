class ViewItem < ApplicationRecord
  belongs_to :view
  belongs_to :item

  validates :item_id, uniqueness: { scope: :view_id }
  validates :x, :y, presence: true, numericality: true
  validates :z_index, presence: true, numericality: { only_integer: true }
end
