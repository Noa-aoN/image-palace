class SharedMedia < ApplicationRecord
  self.table_name = "shared_medias"

  belongs_to :user, optional: true
  has_one_attached :file
  # 一覧用サムネ（480px WebP）のキャッシュ。重複排除されたカードで共有する。
  has_one_attached :thumb

  validates :normalized_prompt, presence: true

  scope :for_prompt, ->(prompt) { where(normalized_prompt: prompt).order(created_at: :desc) }
end
