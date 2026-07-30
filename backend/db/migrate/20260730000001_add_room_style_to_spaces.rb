# frozen_string_literal: true

class AddRoomStyleToSpaces < ActiveRecord::Migration[8.1]
  def change
    # 部屋の見た目。プリセット名＋個別上書き（面の色・グリッド）。2D/3D 共通で使う。
    # 上書きは任意項目が増えうるため jsonb にする（キーとフォーマットは Space 側で検証する）。
    add_column :spaces, :room_style, :string, default: "ivory", null: false
    add_column :spaces, :style_overrides, :jsonb, default: {}, null: false
  end
end
