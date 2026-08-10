class AddImageModelToItems < ActiveRecord::Migration[8.1]
  # カードごとに、どのモデルで絵を作るかを覚えておく。
  #
  # これまでは環境変数で全体を1つに固定していたため、
  # 「この単語は別のモデルのほうが合う」を選べなかった。
  #
  # null は「おまかせ」＝そのときの既定。既存カードは触らない。
  def change
    add_column :items, :image_model, :string
  end
end
