class CreateSpaces < ActiveRecord::Migration[8.1]
  def change
    create_table :spaces, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :name, null: false
      t.text :description

      t.timestamps
    end

    add_index :spaces, :user_id
    add_index :spaces, [ :user_id, :created_at ]
    add_foreign_key :spaces, :users, on_delete: :cascade
  end
end
