# frozen_string_literal: true

# 見立て1件。
#
# **AI が書いたものと、人が決めたことを分ける。**
# 観察・根拠・確信度は生成時のまま動かさない。後から書き換えると、
# 何を根拠にそう言ったのかが失われる。
# 読んだ・見送った・片づいた、は人の側の話なので後から変えてよい。
class AdminInsight < ApplicationRecord
  belongs_to :admin_brief

  CONFIDENCE = %w[low medium high].freeze
  LEVELS = %w[low medium high].freeze
  STATUSES = %w[open reviewed dismissed resolved].freeze

  validates :observation, :suggested_action, presence: true
  validates :confidence, inclusion: { in: CONFIDENCE }
  validates :impact, :urgency, inclusion: { in: LEVELS }
  validates :status, inclusion: { in: STATUSES }
  # **根拠の無い見立ては置かない。** 数字を伴わない指摘は、次の判断に使えない
  validate :evidence_present

  private

  def evidence_present
    errors.add(:evidence, "根拠がありません") if Array(evidence).empty?
  end
end
