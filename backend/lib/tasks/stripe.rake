# frozen_string_literal: true

namespace :stripe do
  desc "Plan 定義から Stripe の Products/Prices を作成し stripe_*_id を埋める（環境ごとに実行）"
  task sync_plans: :environment do
    result = Billing::SyncPlans.call(logger: ->(msg) { puts msg })
    puts "done. products=#{result.created_products} prices=#{result.created_prices}"
  end
end
