class Space < ApplicationRecord
  belongs_to :user
  has_many :rooms, dependent: :destroy

  NAME_MAX_LENGTH = 100

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }
end
