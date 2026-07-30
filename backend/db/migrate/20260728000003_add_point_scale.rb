# frozen_string_literal: true

class AddPointScale < ActiveRecord::Migration[8.1]
  def change
    # ポイント表示サイズ。spaces.point_scale = 部屋共通の既定倍率、space_points.scale = 個別倍率。
    # 実効サイズ = 基準 * point_scale * scale。
    add_column :spaces, :point_scale, :float, default: 1.0, null: false
    add_column :space_points, :scale, :float, default: 1.0, null: false
  end
end
