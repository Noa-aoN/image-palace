FactoryBot.define do
  factory :space do
    user
    sequence(:name) { |n| "space-#{n}" }
    space_type { "room" }

    trait :road do
      space_type { "road" }
    end
  end
end
