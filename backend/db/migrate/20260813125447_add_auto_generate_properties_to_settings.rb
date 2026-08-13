class AddAutoGeneratePropertiesToSettings < ActiveRecord::Migration[8.0]
  def change
    # カードを作るときに、項目（読み仮名・別名など）も一緒に埋めるか。
    #
    # 既定は false。AI の呼び出しが1回増えるので、明示的に選んでもらう。
    # 意味・タグ（既定 true）と違い、これは「項目を持っている人」にしか効かない設定だった
    # ものを、選んだ時点で項目そのものを用意する形にしたぶん、既定は控えめにする。
    add_column :settings, :auto_generate_properties, :boolean, default: false, null: false
  end
end
