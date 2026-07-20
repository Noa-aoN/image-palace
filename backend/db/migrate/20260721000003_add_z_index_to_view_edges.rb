class AddZIndexToViewEdges < ActiveRecord::Migration[8.1]
  def change
    add_column :view_edges, :z_index, :integer, default: 0, null: false
  end
end
