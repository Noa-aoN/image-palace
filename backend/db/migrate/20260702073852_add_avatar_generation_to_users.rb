class AddAvatarGenerationToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :avatar_generation_status, :string
    add_column :users, :avatar_generation_error, :string
  end
end
