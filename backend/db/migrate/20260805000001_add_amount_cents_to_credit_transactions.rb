# frozen_string_literal: true

# 購入時に実際に支払われた金額。
#
# これまで台帳には「何ポイント増えたか」しか残していなかったため、
# 未使用ぶんを返金しようとしても、いくら返せばよいか計算できなかった。
# サービスを終えるとき・返金するとき・売上を見るときに必ず要る。
#
# 付与（無料枠・ボーナス）は支払いを伴わないので nil のままにする。
class AddAmountCentsToCreditTransactions < ActiveRecord::Migration[8.1]
  def change
    add_column :credit_transactions, :amount_cents, :integer
    add_column :credit_transactions, :currency, :string
  end
end
