class CreateRoadPoints < ActiveRecord::Migration[8.1]
  def change
    create_table :road_points, id: :uuid do |t|
      t.uuid :road_id, null: false
      # 空ポイントを許容するため item_id は nullable。カード削除時は nullify。
      t.uuid :item_id
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :road_points, :road_id
    add_index :road_points, [ :road_id, :position ]
    add_foreign_key :road_points, :roads, on_delete: :cascade
    add_foreign_key :road_points, :items, on_delete: :nullify
  end
end
