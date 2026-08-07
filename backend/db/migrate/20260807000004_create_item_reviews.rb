# frozen_string_literal: true

# カード1枚ごとの、確認した記録。
#
# 学習支援サービスなのに、何をいつ確認したかがサーバーに1件も残っていなかった。
# 記録は端末の localStorage にセッション単位で置かれるだけで、
#   ・端末を変えると消える
#   ・カードごとの確認回数が出せない
#   ・復習の優先度も、忘れかけているカードも分からない
# 覚えたかどうかを測る側が空のままだった。
#
# 1行 = 1枚を1回確認した記録。集計はここから出す。
# 「習熟度」のような導出値を列で持たないのは、決め方（間隔反復の設計）が
# まだ決まっていないため。生の記録さえ残っていれば、あとからどうとでも出せる。
class CreateItemReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :item_reviews, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :item, null: false, foreign_key: true, type: :uuid
      # correct / incorrect … 正誤の分かる出題。seen … 見返しただけ
      t.string :result, null: false
      # practice / quiz / game のどれで確認したか
      t.string :mode, null: false
      t.datetime :reviewed_at, null: false
      t.timestamps
    end

    # カードの記録を新しい順に引く（詳細画面の集計）
    add_index :item_reviews, [ :item_id, :reviewed_at ]
    # その人の学習量を期間で引く（ダッシュボード・連続日数）
    add_index :item_reviews, [ :user_id, :reviewed_at ]
  end
end
