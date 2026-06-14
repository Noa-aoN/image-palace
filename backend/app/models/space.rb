class Space < ApplicationRecord
  belongs_to :user
  has_many :space_collections, dependent: :destroy
  has_many :collections, through: :space_collections
  has_many :space_points, dependent: :destroy
  has_many :collection_entries, as: :entry, dependent: :destroy

  NAME_MAX_LENGTH = 100
  # room（棚＝コレクションを並べる） / road（連結法＝序数ポイントにカードを置く）
  SPACE_TYPES = %w[room road].freeze

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }
  validates :space_type, inclusion: { in: SPACE_TYPES }

  scope :recent, -> { order(created_at: :desc) }
end
