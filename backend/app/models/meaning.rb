class Meaning < ApplicationRecord
  belongs_to :item

  # 説明の詳しさレベル（ひとこと / シンプル / くわしく）
  DETAIL_LEVELS = %w[brief simple detailed].freeze
  DEFAULT_DETAIL_LEVEL = "simple"

  validates :definition, presence: true
  validates :language_code, presence: true
  validates :detail_level, inclusion: { in: DETAIL_LEVELS }

  scope :in_language, ->(lang) { where(language_code: lang) }

  # 不正値は既定（simple）へ丸める
  def self.normalize_level(level)
    DETAIL_LEVELS.include?(level.to_s) ? level.to_s : DEFAULT_DETAIL_LEVEL
  end
end
