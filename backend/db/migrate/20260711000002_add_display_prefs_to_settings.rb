class AddDisplayPrefsToSettings < ActiveRecord::Migration[8.1]
  def change
    # 図（間取り図・記憶資産など）の表現。"2d" / "3d"。既定は既存の見た目に合わせて 3d。
    add_column :settings, :diagram_mode, :string, null: false, default: "3d"
    # アニメーションの扱い。"auto"（OS の prefers-reduced-motion に従う）/ "on" / "off"。
    add_column :settings, :motion_mode, :string, null: false, default: "auto"
  end
end
