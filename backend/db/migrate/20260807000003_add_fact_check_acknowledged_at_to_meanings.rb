# frozen_string_literal: true

# ファクトチェックの指摘を「人が読んで判断した」と記録するための日時。
#
# これまで、判定が出たあとに取り消す手段が無かった。誤検知でも判定は残り、
# 一覧のカードでは単語名が赤や黄色のままになる。棚を開くたびに、解決済みの
# 指摘で警告され続けることになっていた。
#
# 「AIが間違っている」と主張させるのではなく「人が見て決めた」と記録する。
# 後から見返したときに、そのほうが正確に読める。
#
# 説明を書き換えたら判定ごと無効化される仕組み（FACT_CHECK_ATTRIBUTES）に
# 相乗りするので、書き換え後は自動で未確認へ戻る。
class AddFactCheckAcknowledgedAtToMeanings < ActiveRecord::Migration[8.0]
  def change
    add_column :meanings, :fact_check_acknowledged_at, :datetime
  end
end
