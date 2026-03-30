class Media < ApplicationRecord
  self.table_name = "medias"

  belongs_to :item
  has_one_attached :file

  validates :media_type, presence: true

  scope :ordered, -> { order(:position) }
end
