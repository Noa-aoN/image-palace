# frozen_string_literal: true

class AddBillingColumnsToPlans < ActiveRecord::Migration[8.1]
  def change
    # tier: free/standard/pro/creator/studio/topup（表示・分類用）
    add_column :plans, :tier, :string
    # kind: subscription（定期）/ one_time（Top-up等の買い切り）
    add_column :plans, :kind, :string, null: false, default: "subscription"
    # 通貨。JPY はゼロ小数通貨のため price_cents は「最小単位＝円」をそのまま入れる
    add_column :plans, :currency, :string, null: false, default: "jpy"
    # 1周期あたり付与クレジット数（subscription）/ 購入で付与する数（one_time）
    add_column :plans, :credits_per_period, :integer, null: false, default: 0
    # 表示の有効/無効
    add_column :plans, :active, :boolean, null: false, default: true
    # Stripe 連携ID（Products/Prices 作成後に埋める）
    add_column :plans, :stripe_product_id, :string
    add_column :plans, :stripe_price_id, :string

    add_index :plans, :stripe_price_id, unique: true, where: "stripe_price_id IS NOT NULL"
  end
end
