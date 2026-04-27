class AddPasswordResetFieldsToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :reset_password_token, :string
    add_column :users, :reset_password_sent_at, :datetime
    add_column :users, :allow_password_change, :boolean, default: false, null: false

    add_index :users, :reset_password_token, unique: true
  end
end
