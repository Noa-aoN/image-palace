# frozen_string_literal: true

# 運営からユーザーへ届ける読みもの（お知らせ・更新情報・コラム）。
#
# コラムはこれまでフロントのコードに直接書いていたため、記事を1本足すのに
# デプロイが要った。運営の画面から書けるようにする。
#
# 種類で分けるが、持ち物は同じなので1つの表にまとめる。
# 本文は段落・見出しといった塊の並びで持つ（フロント側の描画に合わせる）。
class CreatePosts < ActiveRecord::Migration[8.1]
  def change
    create_table :posts, id: :uuid do |t|
      t.string :slug, null: false
      # news（お知らせ） / update（更新情報） / column（コラム）
      t.string :category, null: false, default: "news"
      t.string :title, null: false
      t.text :excerpt
      # [{ "type": "p", "text": "..." }, { "type": "h2", "text": "..." }, ...]
      t.jsonb :body, null: false, default: []
      t.jsonb :tags, null: false, default: []
      t.integer :reading_minutes
      # nil のあいだは下書き。入れた時点から公開される
      t.datetime :published_at
      # 一覧の先頭に留めるか
      t.boolean :pinned, null: false, default: false
      # お知らせとして配信した日時（二重配信を防ぐ）
      t.datetime :delivered_at
      t.references :author, type: :uuid, foreign_key: { to_table: :users, on_delete: :nullify }, index: false
      t.timestamps
    end

    add_index :posts, :slug, unique: true
    add_index :posts, [ :category, :published_at ]
  end
end
