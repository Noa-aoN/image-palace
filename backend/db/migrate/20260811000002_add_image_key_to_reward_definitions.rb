class AddImageKeyToRewardDefinitions < ActiveRecord::Migration[8.1]
  # 画像の置き場を、環境をまたいで指せるようにする。
  #
  # 添付（ActiveStorage）は環境ごとに別の DB・別のストレージにある。
  # 本番で作った絵が手元に無いのはそのためで、ユーザーごとに作っているわけではない
  # （絵は定義に付くので、全員で同じものを見る）。
  #
  # 配信先の鍵をここに持てば、どの環境からも同じ絵を指せる。
  # 差し替えは添付が優先（管理画面から上げたものが常に勝つ）。
  def change
    add_column :reward_definitions, :image_key, :string
  end
end
