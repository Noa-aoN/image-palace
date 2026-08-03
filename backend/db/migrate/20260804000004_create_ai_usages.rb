# frozen_string_literal: true

# 画像以外の AI 利用（文章生成）の記録。
#
# 画像生成はクレジットで数えられるが、意味・タグ・ファクトチェック・単語生成は
# 何回呼ばれているのかも、いくら掛かっているのかも見えていなかった。
# 特にファクトチェックは他より高いモデルを使い、何度でも押せる。
#
# まず記録して見えるようにする。上限や課金はその上で判断する。
class CreateAiUsages < ActiveRecord::Migration[8.1]
  def change
    create_table :ai_usages, id: :uuid do |t|
      # 誰の操作か。ユーザーに紐づかない呼び出し（将来の運用バッチ等）は null
      t.references :user, type: :uuid, foreign_key: { on_delete: :cascade }, index: false
      # 何のための呼び出しか（meaning / tags / fact_check / brief / words_generate ...）
      t.string :kind, null: false
      t.string :model, null: false
      t.integer :prompt_tokens, null: false, default: 0
      t.integer :completion_tokens, null: false, default: 0
      # 消費したクレジット（ポイント）。0 は無料扱いの呼び出し
      t.integer :cost_points, null: false, default: 0
      t.datetime :created_at, null: false
    end

    # 「この人の今期の利用」を引くための索引
    add_index :ai_usages, [ :user_id, :created_at ]
    add_index :ai_usages, [ :user_id, :kind, :created_at ]
  end
end
