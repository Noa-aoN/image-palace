# frozen_string_literal: true

class AddStripeAndCreditsToUsers < ActiveRecord::Migration[8.1]
  def change
    # Stripe 顧客ID（1ユーザー=1顧客）
    add_column :users, :stripe_customer_id, :string
    add_index :users, :stripe_customer_id, unique: true

    # クレジット残高は2バケット制：
    # - subscription_credits: 月次付与・期末リセット（使い切り）
    # - topup_credits: 買い切りで繰り越し
    add_column :users, :subscription_credits, :integer, null: false, default: 0
    add_column :users, :topup_credits, :integer, null: false, default: 0
  end
end
