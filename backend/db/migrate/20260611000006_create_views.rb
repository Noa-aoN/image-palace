class CreateViews < ActiveRecord::Migration[8.1]
  def change
    create_table :views, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :name, null: false
      t.string :view_type, null: false, default: "freeboard"

      t.timestamps
    end

    add_index :views, :user_id
    add_index :views, [ :user_id, :created_at ]
    add_foreign_key :views, :users, on_delete: :cascade
  end
end
