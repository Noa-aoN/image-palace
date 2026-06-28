class AddDefaultImageStyleToSettings < ActiveRecord::Migration[8.1]
  def change
    # 新規カードのデフォルト画像スタイル。"" は「おまかせ（指定なし）」を表す。
    add_column :settings, :default_image_style, :string, null: false, default: ""
  end
end
