FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}-#{SecureRandom.hex(4)}@example.com" }
    password { "password123" }
    password_confirmation { "password123" }
    provider { "email" }
    uid { email }

    trait :confirmed do
      confirmed_at { Time.current }
    end

    trait :oauth do
      provider { "google_oauth2" }
      uid { SecureRandom.uuid }
    end
  end
end
