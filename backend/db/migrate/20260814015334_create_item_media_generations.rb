class CreateItemMediaGenerations < ActiveRecord::Migration[8.0]
  def change
    # そのカードで、これまでにどの絵を使ったか。
    #
    # **絵そのものは増やさない。** 生成した絵は shared_medias に残っていて、
    # 消えていないし、強制の作り直しも別の行として積まれる。
    # 失われていたのは「いつ、どれを使ったか」の結びつきだけだった
    # （作り直しのたびに medias の古い行を消していたため）。
    #
    # ここは行を足すだけ。1件あたり数十バイトで、blob は1つも増えない。
    create_table :item_media_generations, id: :uuid do |t|
      t.references :item, null: false, foreign_key: true, type: :uuid, index: false
      # 表の名前は shared_medias（複数形が不規則なので、参照先を明示する）
      t.references :shared_media, null: false, foreign_key: { to_table: :shared_medias }, type: :uuid
      # そのときの指示とモデル。あとから「なぜこの絵になったか」を辿るために持つ
      t.text :prompt
      t.string :model
      t.datetime :used_at, null: false
      t.timestamps
    end

    # 同じ絵に戻したときは、行を増やさず時刻を更新する。
    # 行き来するたびに増えると、選ぶ一覧が同じ絵で埋まる
    add_index :item_media_generations, [ :item_id, :shared_media_id ], unique: true
    add_index :item_media_generations, [ :item_id, :used_at ]
  end
end
