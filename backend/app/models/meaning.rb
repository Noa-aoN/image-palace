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
  # 並びは position。埋まっていない古い行が混じっても、作成順で後ろに落ち着かせる
  scope :ordered, -> { order(Arel.sql("position NULLS LAST"), :created_at) }

  before_create :assign_position

  # ファクトチェック結果を構成する属性。説明や単語名が変わったら丸ごと無効化する
  FACT_CHECK_ATTRIBUTES = %w[
    fact_check_status fact_check_comment fact_check_suggestion
    fact_check_title_suggestion fact_check_known fact_checked_at
  ].freeze

  # 以前の判定を消す（保存はしない）。項目が増えても消し忘れないよう1か所にまとめる
  def clear_fact_check
    assign_attributes(FACT_CHECK_ATTRIBUTES.index_with(nil).merge("fact_check_claims" => []))
  end

  # 不正値は既定（simple）へ丸める
  def self.normalize_level(level)
    DETAIL_LEVELS.include?(level.to_s) ? level.to_s : DEFAULT_DETAIL_LEVEL
  end

  private

  # 末尾に足す。並べ替えは position の書き換えで行う
  def assign_position
    return if position.present?

    self.position = (item&.meanings&.maximum(:position) || -1) + 1
  end
end
