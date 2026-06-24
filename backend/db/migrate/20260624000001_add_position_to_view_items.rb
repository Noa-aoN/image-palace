# frozen_string_literal: true

class AddPositionToViewItems < ActiveRecord::Migration[8.1]
  def change
    # deck 種別のビューでカードの並び順を保持する（freeboard=x/y, space_map=space_point, deck=position）。
    add_column :view_items, :position, :integer
  end
end
