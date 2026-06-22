# frozen_string_literal: true

class AddStripeColumnsToSubscriptions < ActiveRecord::Migration[8.1]
  def change
    add_column :subscriptions, :stripe_subscription_id, :string
    add_column :subscriptions, :stripe_customer_id, :string
    add_column :subscriptions, :current_period_start, :datetime
    add_column :subscriptions, :cancel_at_period_end, :boolean, null: false, default: false
    add_column :subscriptions, :canceled_at, :datetime

    add_index :subscriptions, :stripe_subscription_id, unique: true, where: "stripe_subscription_id IS NOT NULL"
    add_index :subscriptions, :stripe_customer_id
  end
end
