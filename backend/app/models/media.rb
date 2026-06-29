class Media < ApplicationRecord
  self.table_name = "medias"

  belongs_to :item
  has_one_attached :file
  # 一覧用サムネ（480px WebP）。CDN 直配信のため生成時に事前作成する。
  has_one_attached :thumb

  validates :media_type, presence: true

  scope :ordered, -> { order(:position) }
end
