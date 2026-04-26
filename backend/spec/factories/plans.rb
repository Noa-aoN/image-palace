FactoryBot.define do
  # Plan は seeds.rb で投入される共有レコード（free / pro）。
  # find_or_create_by! で重複を回避する。
  factory :plan do
    name { "free" }
    price_cents { 0 }
    interval { "month" }
    metadata { {} }

    initialize_with do
      Plan.find_or_create_by!(name: name) do |plan|
        plan.price_cents = price_cents
        plan.interval = interval
        plan.metadata = metadata
      end
    end

    trait :pro do
      name { "pro" }
      price_cents { 1000 }
    end
  end
end
