class AddLivemodeToSubscriptions < ActiveRecord::Migration[8.1]
  def change
    # テスト（Stripe のサンドボックス）で作った契約か、本物か。
    #
    # 決済（credit_transactions.livemode）と同じ理由。
    # 分けないと「有料契約 3件」がテストで叩いた3件のことになる。
    #
    # 既存の行は本番の決済がまだ無かった時期のものなので、テスト扱いで足りる（nil のまま）。
    add_column :subscriptions, :livemode, :boolean
    add_index :subscriptions, [ :livemode, :status ]
  end
end
