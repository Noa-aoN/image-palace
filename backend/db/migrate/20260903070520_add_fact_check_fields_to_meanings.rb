class AddFactCheckFieldsToMeanings < ActiveRecord::Migration[8.1]
  # 何を見たうえでの判定なのかを残す。
  #
  # 「説明だけ見た」のか「項目もぜんぶ見た」のかで、同じ correct でも重みが違う。
  # claims からは数えられない（指摘の出なかった項目は claims に現れないため）。
  #
  # 既定は空配列。**古い行は「説明だけを見た」ものとして残す**
  # （後から埋め直すと、見ていないものを見たことにしてしまう）。
  def change
    add_column :meanings, :fact_check_fields, :jsonb, default: [], null: false
  end
end
