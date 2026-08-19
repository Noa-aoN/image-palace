# frozen_string_literal: true

# 公式コンテンツの、公開された姿。
#
# 原本（公式アカウントの箱とキャンバス）とは分けて持つ。
# 原本は運営が触り続けるが、**公開したものは動かない**。
# 配ったあとで原本のカードを消しても、配布中のものは壊れない。
#
# 中身は `payload` の jsonb にまとめて入れる。
# 運ぶ項目が増えても、ここへ列を足すことにはならない。
class CreateContentPackages < ActiveRecord::Migration[8.1]
  def change
    create_table :content_packages, id: :uuid do |t|
      # 何の荷物か（"starter_it" / "demo_showcase" など）
      t.string :key, null: false
      # 出すたびに1つ上がる。**古い版も残す**（誰が何を持っているか辿るため）
      t.integer :version, null: false
      # demo / starter / advance
      t.string :kind, null: false
      # draft / published / archived
      t.string :status, null: false, default: "draft"

      # 受け取る画面に出すもの
      t.string :name, null: false
      t.text :summary
      # 表紙。ActiveStorage の blob の鍵（獲得物と同じ持ち方）
      t.string :cover_image_key

      # 書き出した中身そのもの
      t.jsonb :payload, null: false, default: {}

      t.datetime :published_at

      t.timestamps
    end

    # 同じ鍵で同じ版は1つだけ。**公開が競合しても、必ずどちらかが落ちる**
    add_index :content_packages, [ :key, :version ], unique: true
    # 「いま配れるもの」を引く
    add_index :content_packages, [ :kind, :status ]
  end
end
