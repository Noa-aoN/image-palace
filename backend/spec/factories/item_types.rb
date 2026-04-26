FactoryBot.define do
  # ItemType は seeds.rb で投入される共有レコード。
  # find_or_create_by! で重複を回避する。
  factory :item_type do
    name  { "term" }
    label { "単語" }

    initialize_with do
      ItemType.find_or_create_by!(name: name) do |it|
        it.label = label
      end
    end

    trait(:concept) { name { "concept" }; label { "概念" } }
    trait(:entity)  { name { "entity" };  label { "実体" } }
    trait(:person)  { name { "person" };  label { "人物" } }
    trait(:event)   { name { "event" };   label { "出来事" } }
  end
end
