# frozen_string_literal: true

# 供給側（OpenAI 等）の停止の記録。
#
# 「いま生成が止まっているのはこちらの不具合か、外の都合か」を運営が即断できるようにする。
class ProviderIncident < ApplicationRecord
  QUOTA_EXHAUSTED = "quota_exhausted"

  # 同じ事象が続く間は1行にまとめる窓。カード一括作成で件数ぶん行を作らないため
  DEDUP_WINDOW = 1.hour
  # 「今も続いている」と見なす窓。これより古ければ復旧した可能性が高い
  ONGOING_WINDOW = 6.hours

  validates :provider, :kind, presence: true

  scope :latest_first, -> { order(last_occurred_at: :desc) }

  # 直近の同一事象があればまとめ、無ければ作る。作った/まとめた行を返す。
  # occurrences == 1 なら新規の発生（通知を出す判断に使う）。
  def self.record!(provider:, kind:, code: nil, message: nil, now: Time.current)
    recent = where(provider: provider, kind: kind)
             .where(last_occurred_at: (now - DEDUP_WINDOW)..)
             .latest_first
             .first

    if recent
      recent.update!(
        occurrences: recent.occurrences + 1,
        last_occurred_at: now,
        code: code.presence || recent.code,
        message: message.presence || recent.message
      )
      recent
    else
      create!(
        provider: provider,
        kind: kind,
        code: code,
        message: message,
        first_occurred_at: now,
        last_occurred_at: now
      )
    end
  end

  def ongoing?(now: Time.current)
    last_occurred_at > now - ONGOING_WINDOW
  end
end
