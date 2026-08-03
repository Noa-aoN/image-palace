# frozen_string_literal: true

# ライブラリの棚の並び順。
#
# 何をよく使うかは人によって違う。カードから見たい人もいれば、
# スペースを起点に動く人もいる。並び順を選べるようにする。
#
# 空配列は「既定の順」。増えた棚が勝手に消えないよう、保存された順に
# 載っていない棚は末尾へ回して必ず全て表示する（正規化は Setting 側で行う）。
class AddLibraryOrderToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :library_order, :jsonb, null: false, default: []
  end
end
