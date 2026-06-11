class CreateCollectionEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :collection_entries, id: :uuid do |t|
      t.uuid :collection_id, null: false
      # ポリモーフィック: Item / Deck / Space / View をまとめられる
      t.string :entry_type, null: false
      t.uuid :entry_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :collection_entries, :collection_id
    add_index :collection_entries, [ :entry_type, :entry_id ]
    add_index :collection_entries, [ :collection_id, :entry_type, :entry_id ],
      unique: true, name: "index_collection_entries_uniqueness"
    add_foreign_key :collection_entries, :collections, on_delete: :cascade
  end
end
