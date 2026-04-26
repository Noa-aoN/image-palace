class AddDeviseTokenAuthFieldsToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :provider, :string, null: false, default: 'email'
    add_column :users, :uid, :string, null: false, default: ''
    add_column :users, :tokens, :jsonb, default: {}, null: false

    add_index :users, [ :provider, :uid ], unique: true
  end
end
