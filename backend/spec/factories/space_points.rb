FactoryBot.define do
  factory :space_point do
    association :space, factory: [ :space, :road ]
    position { 1 }
    item { nil }
  end
end
