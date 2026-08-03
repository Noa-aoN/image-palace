# frozen_string_literal: true

# 単語 → 説明文 → 情景プロンプト の結果を、単語ごとに世界で1行だけ持つキャッシュ。
# shared_medias（画像のキャッシュ）と同じ役割を、その手前の工程に対して果たす。
class SharedBrief < ApplicationRecord
  SUBJECT_KINDS = %w[concrete abstract].freeze

  validates :normalized_source, presence: true, uniqueness: true
  validates :description, presence: true
  validates :scene_prompt, presence: true
  validates :subject_kind, inclusion: { in: SUBJECT_KINDS }

  scope :for_source, ->(source) { where(normalized_source: source) }
end
