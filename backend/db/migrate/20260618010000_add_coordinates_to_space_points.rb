class AddCoordinatesToSpacePoints < ActiveRecord::Migration[8.1]
  def change
    # room 種別の間取り配置用の座標。road は序数（position）で並べるため未使用。
    add_column :space_points, :x, :float, null: false, default: 0.0
    add_column :space_points, :y, :float, null: false, default: 0.0
  end
end
