class AddGenerationStatusToItems < ActiveRecord::Migration[8.1]
  def change
    add_column :items, :generation_status, :string, null: false, default: "pending"
    add_index :items, :generation_status
  end
end
