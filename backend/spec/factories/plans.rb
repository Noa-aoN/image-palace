FactoryBot.define do
  # Plan は seeds.rb で投入される共有レコード。find_or_create_by! で重複を回避する。
  factory :plan do
    name { "free" }
    tier { "free" }
    kind { "subscription" }
    interval { "month" }
    price_cents { 0 }
    currency { "jpy" }
    credits_per_period { 10 }
    active { true }

    initialize_with do
      Plan.find_or_create_by!(name: name) do |plan|
        plan.tier = tier
        plan.kind = kind
        plan.interval = interval
        plan.price_cents = price_cents
        plan.currency = currency
        plan.credits_per_period = credits_per_period
        plan.active = active
      end
    end

    trait :standard do
      name { "standard" }
      tier { "standard" }
      price_cents { 1480 }
      credits_per_period { 100 }
    end

    trait :topup do
      name { "topup_100" }
      tier { "topup" }
      kind { "one_time" }
      interval { nil }
      price_cents { 1200 }
      credits_per_period { 100 }
    end
  end
end
