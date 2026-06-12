class Tag < ApplicationRecord
  belongs_to :user
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags

  NAME_MAX_LENGTH = 50

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH },
                   uniqueness: { scope: :user_id, case_sensitive: false }

  scope :ordered, -> { order(:name) }
end
