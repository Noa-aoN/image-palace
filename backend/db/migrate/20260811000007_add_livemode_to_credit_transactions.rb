class AddLivemodeToCreditTransactions < ActiveRecord::Migration[8.1]
  def change
    # 本物の決済か、テスト（Stripe のサンドボックス）か。
    #
    # これが無いと、テストの決済が売上に混ざる。「今月いくら入ったか」を
    # 見ているつもりで、自分で叩いたテストの額を見ていることになる。
    #
    # 支払いを伴わない行（付与・消費・失効）は null のまま。
    add_column :credit_transactions, :livemode, :boolean
    add_index :credit_transactions, [ :livemode, :created_at ]
  end
end
