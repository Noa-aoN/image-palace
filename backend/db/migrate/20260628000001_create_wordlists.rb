class CreateWordlists < ActiveRecord::Migration[8.1]
  def change
    create_table :wordlists, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :name, null: false
      t.string :words, array: true, null: false, default: []

      t.timestamps
    end

    add_index :wordlists, :user_id
    add_index :wordlists, [ :user_id, :created_at ]
    add_foreign_key :wordlists, :users, on_delete: :cascade
  end
end
