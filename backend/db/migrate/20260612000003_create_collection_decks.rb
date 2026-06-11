class CreateCollectionDecks < ActiveRecord::Migration[8.1]
  def change
    create_table :collection_decks, id: :uuid do |t|
      t.uuid :collection_id, null: false
      t.uuid :deck_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :collection_decks, :collection_id
    add_index :collection_decks, [ :collection_id, :deck_id ], unique: true
    add_foreign_key :collection_decks, :collections, on_delete: :cascade
    add_foreign_key :collection_decks, :decks, on_delete: :cascade
  end
end
