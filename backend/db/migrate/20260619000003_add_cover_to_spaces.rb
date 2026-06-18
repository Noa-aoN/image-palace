class AddCoverToSpaces < ActiveRecord::Migration[8.1]
  def change
    # デッキ踏襲のカバー設定。スペースはカードではなく「ポイントの生成画像」をカバー候補に使うため、
    # 表紙指定は cover_space_point_id（SpacePoint 参照）にする。
    add_column :spaces, :cover_space_point_id, :uuid
    add_column :spaces, :cover_type, :string, null: false, default: "first_card"
    add_foreign_key :spaces, :space_points, column: :cover_space_point_id, on_delete: :nullify
    add_index :spaces, :cover_space_point_id
  end
end
