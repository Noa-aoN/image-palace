FactoryBot.define do
  factory :subscription do
    association :user
    association :plan
    status { "active" }
    started_at { Time.current }
  end
end
