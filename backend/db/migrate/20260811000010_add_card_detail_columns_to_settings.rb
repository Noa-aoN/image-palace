class AddCardDetailColumnsToSettings < ActiveRecord::Migration[8.1]
  def change
    # カード詳細で項目を何列に並べるか（1〜3）。
    #
    # ここに持つのは**既定**。1枚ずつの見え方はカード側（block_view）が持つ、
    # という切り分けに合わせる。項目の少ないカードは1列、多いカードは2列、と
    # カードごとに変えたくなるので、既定だけをアカウントで覚える。
    add_column :settings, :card_detail_columns, :integer, null: false, default: 1
  end
end
