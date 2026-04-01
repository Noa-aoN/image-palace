class SharedMedia < ApplicationRecord
  self.table_name = 'shared_medias'

  belongs_to :user, optional: true
  has_one_attached :file

  validates :normalized_prompt, presence: true

  scope :for_prompt, ->(prompt) { where(normalized_prompt: prompt).order(created_at: :desc) }
end
