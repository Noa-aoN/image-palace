# frozen_string_literal: true

class AddCreditsPeriodStartToUsers < ActiveRecord::Migration[8.1]
  def change
    # 無料枠クレジットを「カレント月」に lazy リセット付与する際の基準（最後に付与した月初）。
    # 有料ユーザーは Stripe webhook 側で付与するためここは使わない。
    add_column :users, :credits_period_start, :datetime
  end
end
