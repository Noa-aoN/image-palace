FactoryBot.define do
  factory :road_point do
    road
    position { 1 }
    item { nil }
  end
end
