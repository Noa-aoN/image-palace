class CreateItems < ActiveRecord::Migration[8.1]
  def change
    create_table :items, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.uuid :item_type_id, null: false
      t.string :title, null: false
      t.text :content
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :items, :user_id
    add_index :items, :item_type_id
    add_index :items, [:user_id, :item_type_id]
    add_foreign_key :items, :users, on_delete: :cascade
    add_foreign_key :items, :item_types, on_delete: :restrict
  end
end
