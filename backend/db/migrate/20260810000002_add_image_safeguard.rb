class AddImageSafeguard < ActiveRecord::Migration[8.1]
  # 生成された絵をいきなり直視しないで済むようにする「セーフガード」。
  #
  # 入り切りは利用者ごとの設定（既定は切）。切っている人の見え方は今までと変わらない。
  #
  # 承認待ちを **medias 側の列**で持つのは、後から設定を入にしたときに
  # 既にある絵まで一斉に隠れてしまうのを避けるため。
  # 「入にしてから作った絵」だけが承認待ちになる。
  def change
    add_column :settings, :image_safeguard, :boolean, default: false, null: false
    add_column :medias, :needs_approval, :boolean, default: false, null: false
  end
end
