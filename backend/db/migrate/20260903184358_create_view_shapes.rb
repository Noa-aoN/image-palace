class CreateViewShapes < ActiveRecord::Migration[8.1]
  # ボードに置く図形。四角・丸・付箋・見出し・かこみ。
  #
  # ## なぜ別のテーブルにするのか
  #
  # カードの置き場所（`view_items`）は `item_id` が必須で、items への外部キーもある。
  # 図形はカードではないので、そこには入らない。**nullable にすると
  # 「カードでもあり図形でもある行」が生まれて、読む側が全部分岐を持つことになる。**
  #
  # `view_edges`（線）が既に「view にぶら下がる、カードではない実体」として
  # 独立している。図形も同じ形にすれば、読み方も保存の仕方も揃う。
  #
  # ## 見た目は jsonb で持つ
  #
  # 図形の種類ごとに要る属性が違う（丸には角の丸めが無い、付箋には折り返しがある）。
  # 列で持つと、種類を足すたびに移行が要る。**受け取り口で許可リストを絞る**ので、
  # 自由な jsonb でも描画へ変なものは流れない。
  def change
    create_table :view_shapes, id: :uuid do |t|
      t.references :view, null: false, foreign_key: true, type: :uuid

      # 種類。rectangle / ellipse / sticky / text / frame
      t.string :kind, null: false

      # 置き場所と大きさ。カードと同じ座標系
      t.float :x, null: false, default: 0
      t.float :y, null: false, default: 0
      t.float :width, null: false, default: 200
      t.float :height, null: false, default: 120

      # 重なり順。**カードや線と同じ盤の上で競う**ので、同じ数え方にする
      t.integer :z_index, null: false, default: 0

      # 中の文字。付箋・見出しで使う
      t.text :text

      # 見た目（塗り・枠・文字の大きさ・角の丸め・回転など）
      t.jsonb :style, null: false, default: {}

      t.timestamps
    end
  end
end
