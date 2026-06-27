class Wordlist < ApplicationRecord
  belongs_to :user

  NAME_MAX_LENGTH = 100
  WORDS_LIMIT = 200

  validates :name, presence: true, length: { maximum: NAME_MAX_LENGTH }

  scope :recent, -> { order(created_at: :desc) }
end
