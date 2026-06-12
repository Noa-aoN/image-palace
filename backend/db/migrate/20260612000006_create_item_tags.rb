class CreateItemTags < ActiveRecord::Migration[8.1]
  def change
    create_table :item_tags, id: :uuid do |t|
      t.uuid :item_id, null: false
      t.uuid :tag_id, null: false

      t.timestamps
    end

    add_index :item_tags, :item_id
    add_index :item_tags, :tag_id
    add_index :item_tags, [ :item_id, :tag_id ], unique: true
    add_foreign_key :item_tags, :items, on_delete: :cascade
    add_foreign_key :item_tags, :tags, on_delete: :cascade
  end
end
