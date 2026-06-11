class CreateCollectionItems < ActiveRecord::Migration[8.1]
  def change
    create_table :collection_items, id: :uuid do |t|
      t.uuid :collection_id, null: false
      t.uuid :item_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :collection_items, :collection_id
    add_index :collection_items, [ :collection_id, :item_id ], unique: true
    add_foreign_key :collection_items, :collections, on_delete: :cascade
    add_foreign_key :collection_items, :items, on_delete: :cascade
  end
end
