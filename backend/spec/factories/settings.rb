FactoryBot.define do
  factory :setting do
    user
    locale { "ja" }
    timezone { "Asia/Tokyo" }
    auto_generate_meanings { false }
  end
end
