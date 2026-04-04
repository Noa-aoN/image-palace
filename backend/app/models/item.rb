class Item < ApplicationRecord
  belongs_to :user
  belongs_to :item_type
  has_many :meanings, dependent: :destroy
  has_many :medias, dependent: :destroy
  has_many :from_relations, class_name: "Relation", foreign_key: :from_item_id, dependent: :destroy
  has_many :to_relations, class_name: "Relation", foreign_key: :to_item_id, dependent: :destroy

  GENERATION_STATUSES = %w[pending processing completed failed].freeze

  validates :title, presence: true
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  def primary_media
    medias.ordered.first || medias.first
  end
end
