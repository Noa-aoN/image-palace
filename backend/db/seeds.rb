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
