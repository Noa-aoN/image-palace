class CreateViewEdges < ActiveRecord::Migration[8.1]
  # フリーボードのカード間接続線（フローチャート）。
  # 新テーブルのみ＝deck/space_map/既存 API に影響しない（additive）。
  # source/target は文字列ノード id（カードは item_id、将来の自由ノードは "n:<id>"）。
  def change
    create_table :view_edges, id: :uuid do |t|
      t.references :view, null: false, foreign_key: true, type: :uuid
      t.string :source_node_id, null: false
      t.string :target_node_id, null: false
      t.string :source_handle
      t.string :target_handle
      t.string :label
      t.jsonb :style, null: false, default: {}

      t.timestamps
    end
  end
end
