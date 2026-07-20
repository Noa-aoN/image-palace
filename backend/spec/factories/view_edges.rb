FactoryBot.define do
  factory :view_edge do
    view
    source_node_id { SecureRandom.uuid }
    target_node_id { SecureRandom.uuid }
  end
end
