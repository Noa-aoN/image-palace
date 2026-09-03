class Meaning < ApplicationRecord
  belongs_to :item

  # 説明の詳しさレベル（ひとこと / シンプル / くわしく）
  DETAIL_LEVELS = %w[brief simple detailed].freeze

  # 何を書いた文か。**「意味」と一括りにすると、短く覚えたい人にも長い解説が出る。**
  # 逆に、もとの意味だけ知りたいのに いまの意味しか無い、も起きる。
  KINDS = %w[meaning description commentary translation origin].freeze
  DEFAULT_KIND = "meaning"

  KIND_LABELS = {
    "meaning" => "意味",
    "description" => "説明",
    "commentary" => "解説",
    "translation" => "翻訳",
    "origin" => "原義"
  }.freeze
  DEFAULT_DETAIL_LEVEL = "simple"

  # AIファクトチェックの判定（正しい / 疑わしい / 誤り）
  FACT_CHECK_STATUSES = %w[correct doubtful incorrect].freeze

  validates :definition, presence: true
  validates :language_code, presence: true
  validates :detail_level, inclusion: { in: DETAIL_LEVELS }
  validates :kind, inclusion: { in: KINDS }
  validates :fact_check_status, inclusion: { in: FACT_CHECK_STATUSES }, allow_nil: true

  scope :in_language, ->(lang) { where(language_code: lang) }
  scope :of_kind, ->(kind) { where(kind: kind) }
  # 並びは position。埋まっていない古い行が混じっても、作成順で後ろに落ち着かせる
  scope :ordered, -> { order(Arel.sql("position NULLS LAST"), :created_at) }

  before_create :assign_position

  # ファクトチェック結果を構成する属性。説明や単語名が変わったら丸ごと無効化する
  FACT_CHECK_ATTRIBUTES = %w[
    fact_check_status fact_check_comment fact_check_suggestion
    fact_check_title_suggestion fact_check_known fact_checked_at
    fact_check_acknowledged_at
  ].freeze

  # 以前の判定を消す（保存はしない）。項目が増えても消し忘れないよう1か所にまとめる
  def clear_fact_check
    assign_attributes(
      FACT_CHECK_ATTRIBUTES.index_with(nil).merge("fact_check_claims" => [], "fact_check_fields" => [])
    )
  end

  # 人が読んで判断したか。確認済みのものは、一覧でも警告色を出さない
  def fact_check_acknowledged?
    fact_check_acknowledged_at.present?
  end

  # 指摘が残っていて、まだ人が見ていないもの
  def fact_check_pending?
    fact_check_status.present? && fact_check_status != "correct" && !fact_check_acknowledged?
  end

  # 不正値は既定（simple）へ丸める
  def self.normalize_level(level)
    DETAIL_LEVELS.include?(level.to_s) ? level.to_s : DEFAULT_DETAIL_LEVEL
  end

  # 知らない種別は既定へ倒す（画面から来た値をそのまま入れない）
  def self.normalize_kind(kind)
    KINDS.include?(kind.to_s) ? kind.to_s : DEFAULT_KIND
  end

  private

  # 末尾に足す。並べ替えは position の書き換えで行う
  def assign_position
    return if position.present?

    self.position = (item&.meanings&.maximum(:position) || -1) + 1
  end
end
