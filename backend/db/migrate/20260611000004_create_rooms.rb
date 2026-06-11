class CreateRooms < ActiveRecord::Migration[8.1]
  def change
    create_table :rooms, id: :uuid do |t|
      t.uuid :space_id, null: false
      t.string :name, null: false
      t.string :layout_type, null: false, default: "shelf"
      t.integer :position

      t.timestamps
    end

    add_index :rooms, :space_id
    add_index :rooms, [ :space_id, :position ]
    add_foreign_key :rooms, :spaces, on_delete: :cascade
  end
end
