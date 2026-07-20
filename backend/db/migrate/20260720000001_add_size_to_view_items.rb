class AddSizeToViewItems < ActiveRecord::Migration[8.1]
  # freeboard カードのリサイズ用。nullable＝NULL はクライアント既定サイズを使う。
  # deck/space_map の既存行は width/height を無視するため無影響（additive・後方互換）。
  def change
    add_column :view_items, :width, :float
    add_column :view_items, :height, :float
  end
end
