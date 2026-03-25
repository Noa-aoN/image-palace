# ItemTypeのseedデータ
item_types_data = [
  { name: "term", label: "単語" },
  { name: "concept", label: "概念" },
  { name: "entity", label: "実体" },
  { name: "person", label: "人物" },
  { name: "event", label: "出来事" }
]

item_types_data.each do |data|
  ItemType.find_or_create_by!(name: data[:name]) do |it|
    it.label = data[:label]
  end
end

# Planのseedデータ
plans_data = [
  { name: "free", price_cents: 0, interval: "month", metadata: {} },
  { name: "pro", price_cents: 1000, interval: "month", metadata: {} }
]

plans_data.each do |data|
  Plan.find_or_create_by!(name: data[:name]) do |plan|
    plan.price_cents = data[:price_cents]
    plan.interval = data[:interval]
    plan.metadata = data[:metadata]
  end
end
