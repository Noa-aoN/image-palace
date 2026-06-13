class CreateViewItems < ActiveRecord::Migration[8.1]
  def change
    create_table :view_items, id: :uuid do |t|
      t.uuid :view_id, null: false
      t.uuid :item_id, null: false
      # フリーボード上の配置（キャンバス座標）
      t.float :x, null: false, default: 0.0
      t.float :y, null: false, default: 0.0
      # 重なり順
      t.integer :z_index, null: false, default: 0

      t.timestamps
    end

    add_index :view_items, [ :view_id, :item_id ], unique: true
    add_index :view_items, :view_id
    add_foreign_key :view_items, :views, on_delete: :cascade
    add_foreign_key :view_items, :items, on_delete: :cascade
  end
end
