class AddSettingsToViews < ActiveRecord::Migration[8.1]
  # フリーボードのボード全体設定（背景色・背景模様・ミニマップ/Controls 表示など）。
  # additive・既定 {} で既存ボードは従来表示。deck/space_map は無視する。
  def change
    add_column :views, :settings, :jsonb, null: false, default: {}
  end
end
