FactoryBot.define do
  factory :view do
    user
    sequence(:name) { |n| "view-#{n}" }
    view_type { "freeboard" }
  end
end
