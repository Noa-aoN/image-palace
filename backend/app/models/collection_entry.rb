class CollectionEntry < ApplicationRecord
  belongs_to :collection
  belongs_to :entry, polymorphic: true

  # コレクションにまとめられるオブジェクトの種別
  ENTRY_TYPES = %w[Item Deck Space View].freeze

  validates :entry_type, inclusion: { in: ENTRY_TYPES }
  validates :entry_id, uniqueness: { scope: [ :collection_id, :entry_type ] }
end
