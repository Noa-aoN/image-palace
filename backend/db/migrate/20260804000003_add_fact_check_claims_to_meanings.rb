# frozen_string_literal: true

# ファクトチェックの根拠を残す。
#
# これまでは判定（correct/doubtful/incorrect）とコメントしか保存していなかったため、
# 判定が外れたときに何を見誤ったのかを追えなかった。説明文から取り出した主張ごとの
# 検証結果を残せば、利用者は判定の当否を自分で確かめられる。
class AddFactCheckClaimsToMeanings < ActiveRecord::Migration[8.1]
  def change
    change_table :meanings, bulk: true do |t|
      # その語について独立に確認できたこと（説明文を読む前の知識）
      t.text :fact_check_known
      # [{ "text": ..., "verdict": "supported|unsupported|contradicted", "note": ... }, ...]
      t.jsonb :fact_check_claims, null: false, default: []
    end
  end
end
