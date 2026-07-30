# frozen_string_literal: true

class AddDimensionsToSpaces < ActiveRecord::Migration[8.1]
  def change
    # 部屋（room）の寸法。3D の箱・2D の各面のアスペクト比に反映する（点の u/v は正規化なので不変）。
    # 単位はメートル相当。road では未使用。
    add_column :spaces, :width, :float, default: 4.0, null: false
    add_column :spaces, :depth, :float, default: 4.0, null: false
    add_column :spaces, :height, :float, default: 2.6, null: false
  end
end
