class RelaxViewItemItemUniquenessForSpaceMap < ActiveRecord::Migration[8.1]
  def change
    # freeboard は 1 ビュー 1 カードのまま、space_map ではカードを複数ポイントに
    # 置けるようにするため、(view_id, item_id) の一意制約を space_point_id が NULL の
    # 行（＝freeboard 配置）に限定する。
    remove_index :view_items, name: "index_view_items_on_view_id_and_item_id"
    add_index :view_items, [ :view_id, :item_id ],
              unique: true,
              where: "space_point_id IS NULL",
              name: "index_view_items_on_view_and_item_freeboard"
  end
end
