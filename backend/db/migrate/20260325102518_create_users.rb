class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users, id: :uuid do |t|
      t.string :name
      t.string :email, null: false
      t.string :encrypted_password
      t.string :role, null: false, default: "user"

      t.timestamps
    end
    add_index :users, :email, unique: true
  end
end
