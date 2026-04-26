class CreateRelations < ActiveRecord::Migration[8.1]
  def change
    create_table :relations, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.uuid :from_item_id, null: false
      t.uuid :to_item_id, null: false
      t.string :relation_type, null: false

      t.timestamps
    end

    add_index :relations, :user_id
    add_index :relations, :from_item_id
    add_index :relations, :to_item_id
    add_index :relations, [ :user_id, :from_item_id, :to_item_id, :relation_type ],
              name: "index_relations_on_unique_relation", unique: true
    add_check_constraint :relations,
      "from_item_id <> to_item_id",
      name: "check_no_self_relation"
    add_foreign_key :relations, :users, on_delete: :cascade
    add_foreign_key :relations, :items, column: :from_item_id, on_delete: :cascade
    add_foreign_key :relations, :items, column: :to_item_id, on_delete: :cascade
  end
end
