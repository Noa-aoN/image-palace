class Meaning < ApplicationRecord
  belongs_to :item

  # 説明の詳しさレベル（ひとこと / シンプル / くわしく）
  DETAIL_LEVELS = %w[brief simple detailed].freeze
  DEFAULT_DETAIL_LEVEL = "simple"

  # AIファクトチェックの判定（正しい / 疑わしい / 誤り）
  FACT_CHECK_STATUSES = %w[correct doubtful incorrect].freeze

  validates :definition, presence: true
  validates :language_code, presence: true
  validates :detail_level, inclusion: { in: DETAIL_LEVELS }
  validates :fact_check_status, inclusion: { in: FACT_CHECK_STATUSES }, allow_nil: true

  scope :in_language, ->(lang) { where(language_code: lang) }

  # 不正値は既定（simple）へ丸める
  def self.normalize_level(level)
    DETAIL_LEVELS.include?(level.to_s) ? level.to_s : DEFAULT_DETAIL_LEVEL
  end
end
