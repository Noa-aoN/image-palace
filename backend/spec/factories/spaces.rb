FactoryBot.define do
  factory :space do
    user
    sequence(:name) { |n| "space-#{n}" }
  end
end
