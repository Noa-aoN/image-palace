# frozen_string_literal: true

class AddRotationToSpacePoints < ActiveRecord::Migration[8.1]
  def change
    # ポイント画像の回転（度）。
    # z は面内の回転で 2D/3D 共通、x と y は 3D でのみ意味を持つ傾き。
    add_column :space_points, :rotation_x, :float, default: 0.0, null: false
    add_column :space_points, :rotation_y, :float, default: 0.0, null: false
    add_column :space_points, :rotation_z, :float, default: 0.0, null: false
  end
end
