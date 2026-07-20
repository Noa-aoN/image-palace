class ViewEdge < ApplicationRecord
  belongs_to :view

  validates :source_node_id, :target_node_id, presence: true
end
