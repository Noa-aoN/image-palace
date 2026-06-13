FactoryBot.define do
  factory :road do
    space
    sequence(:name) { |n| "road-#{n}" }
  end
end
