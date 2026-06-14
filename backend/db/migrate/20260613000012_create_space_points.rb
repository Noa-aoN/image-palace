class CreateSpacePoints < ActiveRecord::Migration[8.1]
  def change
    create_table :space_points, id: :uuid do |t|
      t.uuid :space_id, null: false
      # 空ポイントを許容（カード未割当）。カード削除時は nullify。
      t.uuid :item_id
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :space_points, :space_id
    add_index :space_points, [ :space_id, :position ]
    add_foreign_key :space_points, :spaces, on_delete: :cascade
    add_foreign_key :space_points, :items, on_delete: :nullify
  end
end
