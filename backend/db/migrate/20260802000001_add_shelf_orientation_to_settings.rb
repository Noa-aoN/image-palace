# frozen_string_literal: true

class AddShelfOrientationToSettings < ActiveRecord::Migration[8.1]
  def change
    # 棚の並べ方。rows=横長の棚を縦に積む / columns=縦長の棚を横に並べる。
    # 宮殿スタイルのときだけ効く従属設定。
    add_column :settings, :shelf_orientation, :string, default: "rows", null: false
  end
end
