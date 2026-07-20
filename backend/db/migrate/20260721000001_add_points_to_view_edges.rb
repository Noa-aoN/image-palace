class AddPointsToViewEdges < ActiveRecord::Migration[8.1]
  # フリーボード edge の手動折れ点（フロー座標の配列）。
  # additive・既定 [] ＝自動ルーティング（smoothstep）のまま。
  def change
    add_column :view_edges, :points, :jsonb, null: false, default: []
  end
end
