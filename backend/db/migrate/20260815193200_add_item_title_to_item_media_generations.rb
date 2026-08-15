class AddItemTitleToItemMediaGenerations < ActiveRecord::Migration[8.1]
  # その絵を作ったときの見出し語。
  #
  # **見出し語を変えたら、前の語で作った絵は選べなくする**ため。
  # 残しておくと、1枚のカードで語を書き換えながら絵を集め、
  # あとから好きなものを選び直せてしまう（生成のたびにクレジットは減るが、
  # 語と絵の結びつきが崩れる）。
  #
  # 既にある行は空のまま。空は「いつの語か分からない」ので、選べる側に倒す
  # （後から入れた決まりで、過去に作った絵を取り上げない）。
  def change
    add_column :item_media_generations, :item_title, :string
  end
end
