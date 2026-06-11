class CreateRoomCollections < ActiveRecord::Migration[8.1]
  def change
    create_table :room_collections, id: :uuid do |t|
      t.uuid :room_id, null: false
      t.uuid :collection_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :room_collections, :room_id
    add_index :room_collections, [ :room_id, :collection_id ], unique: true
    add_foreign_key :room_collections, :rooms, on_delete: :cascade
    add_foreign_key :room_collections, :collections, on_delete: :cascade
  end
end
