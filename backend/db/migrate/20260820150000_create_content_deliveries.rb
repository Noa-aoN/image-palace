# frozen_string_literal: true

# 荷物の届け先。**どこで配るか。**
#
# これまでは `kind`（demo / starter / advance）が
# 「何であるか」と「どこへ出るか」を兼ねていた。
# 決めた時点で出し先が固まり、あとから選べない。
# 「デルフォイには出さないが、引き換えコードでだけ渡す」ができなかった。
#
# 届け先を、荷物とは別に持つ。
#
# ## 版ではなく、鍵に付ける
#
# 「starter_it はデルフォイで配る」は**その線の性質**であって、
# v3 の性質ではない。版に付けると、出し直すたびに設定し直しになる。
class CreateContentDeliveries < ActiveRecord::Migration[8.1]
  def change
    create_table :content_deliveries, id: :uuid do |t|
      # 荷物の鍵。**版は持たない**（線に対して1つ）
      t.string :package_key, null: false
      # demo / delphi / campaign / mission / purchase
      t.string :channel, null: false
      t.boolean :enabled, null: false, default: false

      t.timestamps
    end

    # 同じ荷物・同じ届け先は1行だけ
    add_index :content_deliveries, [ :package_key, :channel ], unique: true
    # 「いまその届け先で配っているもの」を引く
    add_index :content_deliveries, [ :channel, :enabled ]
  end
end
