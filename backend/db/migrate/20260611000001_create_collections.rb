class CreateCollections < ActiveRecord::Migration[8.1]
  def change
    create_table :collections, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :name, null: false
      t.text :description

      t.timestamps
    end

    add_index :collections, :user_id
    add_index :collections, [ :user_id, :created_at ]
    add_foreign_key :collections, :users, on_delete: :cascade
  end
end
