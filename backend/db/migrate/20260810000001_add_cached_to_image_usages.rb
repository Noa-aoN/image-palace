class AddCachedToImageUsages < ActiveRecord::Migration[8.1]
  # キャッシュで済んだ生成も記録に残せるようにする。
  #
  # これまで image_usages は「実際に API を呼んだ回数」だけを持っていた。
  # ところが同じ単語の2人目以降はキャッシュで済むのに**クレジットは同じだけ消費する**ため、
  # 利用者から見ると「使ったのに作った記録が無い」状態になっていた。
  #
  # 原価は掛かっていないので、収支の集計はこの列で除外する。
  def change
    add_column :image_usages, :cached, :boolean, default: false, null: false
  end
end
