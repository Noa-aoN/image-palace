FactoryBot.define do
  factory :deck do
    user
    sequence(:name) { |n| "deck-#{n}" }
  end
end
