class CollectionEntry < ApplicationRecord
  belongs_to :collection
  belongs_to :entry, polymorphic: true

  # コレクションにまとめられるオブジェクトの種別（デッキはキャンバスに統合済み）
  ENTRY_TYPES = %w[Item Space View].freeze

  validates :entry_type, inclusion: { in: ENTRY_TYPES }
  validates :entry_id, uniqueness: { scope: [ :collection_id, :entry_type ] }
end
