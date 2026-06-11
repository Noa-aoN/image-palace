class CreateDeckItems < ActiveRecord::Migration[8.1]
  def change
    create_table :deck_items, id: :uuid do |t|
      t.uuid :deck_id, null: false
      t.uuid :item_id, null: false
      t.integer :position

      t.timestamps
    end

    add_index :deck_items, :deck_id
    add_index :deck_items, [ :deck_id, :item_id ], unique: true
    add_foreign_key :deck_items, :decks, on_delete: :cascade
    add_foreign_key :deck_items, :items, on_delete: :cascade
  end
end
