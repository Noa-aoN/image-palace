class Meaning < ApplicationRecord
  belongs_to :item

  validates :definition, presence: true
  validates :language_code, presence: true

  scope :in_language, ->(lang) { where(language_code: lang) }
end
