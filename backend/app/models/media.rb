class Media < ApplicationRecord
  self.table_name = 'medias'

  belongs_to :item

  validates :url, presence: true
  validates :media_type, presence: true

  scope :ordered, -> { order(:position) }
end
