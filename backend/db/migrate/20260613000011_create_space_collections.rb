class CreateSpaceCollections < ActiveRecord::Migration[8.1]
  def change
    create_table :space_collections, id: :uuid do |t|
      t.uuid :space_id, null: false
      t.uuid :collection_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :space_collections, :space_id
    add_index :space_collections, [ :space_id, :collection_id ], unique: true
    add_foreign_key :space_collections, :spaces, on_delete: :cascade
    add_foreign_key :space_collections, :collections, on_delete: :cascade
  end
end
