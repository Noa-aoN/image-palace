# frozen_string_literal: true

# 運営の予算から引き出した記録。
#
# 引き出したぶんは**残高へ入る**ので、使った先は `credit_transactions` に載る。
# ここが数えているのは「今月いくら引き出したか」で、月ごとの上限を見るために要る。
#
# 2026-09-03 より前の行は、**枠から直接使った記録**（当時は財布が分かれていた）。
# 種類（kind）でどちらか分かる。引き出しは "draw"、それ以前は "image" などの使い道。
class StudioUsage < ApplicationRecord
  # 作られた時刻しか持たない（あとから直すものではない）
  self.record_timestamps = false

  belongs_to :user
  belongs_to :item, optional: true

  validates :kind, presence: true
  validates :cost_points, numericality: { only_integer: true, greater_than: 0 }

  before_validation { self.created_at ||= Time.current }
end
