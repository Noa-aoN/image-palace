# frozen_string_literal: true

# 単語から作る「説明文 → 情景プロンプト」の世界共通キャッシュ。
#
# shared_medias が画像そのものを使い回すのと同じ考え方で、
# その手前の下ごしらえ（説明文と情景プロンプト）も同じ単語なら一度しか作らない。
# 画像より遥かに安いとはいえ、同じ計算を人数分繰り返す理由が無いため。
class CreateSharedBriefs < ActiveRecord::Migration[8.1]
  def change
    create_table :shared_briefs, id: :uuid do |t|
      # 正規化した元テキスト（単語＋プロンプト版番号）。同じ単語は同じ行に集約する
      t.string :normalized_source, null: false
      t.text :description, null: false
      t.text :scene_prompt, null: false
      # concrete / abstract。概念語は情景に置き換える必要があるため作り分ける
      t.string :subject_kind, null: false, default: "concrete"
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :shared_briefs, :normalized_source, unique: true
  end
end
