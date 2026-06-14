class AddPinnedToTags < ActiveRecord::Migration[8.1]
  def change
    add_column :tags, :pinned, :boolean, default: false, null: false
  end
end
