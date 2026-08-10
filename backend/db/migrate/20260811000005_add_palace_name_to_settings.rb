class AddPalaceNameToSettings < ActiveRecord::Migration[8.1]
  # 宮殿の名前。
  #
  # 「自分の宮殿」と言いながら名前が無いと、ただの保管庫に見える。
  # 空なら画面側で既定の呼び方に落とすので、入れなかった人の扱いはここで決め打ちしない。
  def change
    add_column :settings, :palace_name, :string
  end
end
