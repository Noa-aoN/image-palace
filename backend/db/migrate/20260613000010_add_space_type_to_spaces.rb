class AddSpaceTypeToSpaces < ActiveRecord::Migration[8.1]
  def change
    add_column :spaces, :space_type, :string, default: "room", null: false
  end
end
