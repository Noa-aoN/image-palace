class AddAutoGenerateTagsToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :auto_generate_tags, :boolean, default: false, null: false
  end
end
