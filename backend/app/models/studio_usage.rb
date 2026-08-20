# frozen_string_literal: true

# 公式制作枠を使った記録。
#
# **通常のクレジットとは別に数える。** 買った残高を減らさないので、
# `credit_transactions` には載らない。だが「いくら使ったか」は要る。
class StudioUsage < ApplicationRecord
  # 作られた時刻しか持たない（あとから直すものではない）
  self.record_timestamps = false

  belongs_to :user
  belongs_to :item, optional: true

  validates :kind, presence: true
  validates :cost_points, numericality: { only_integer: true, greater_than: 0 }

  before_validation { self.created_at ||= Time.current }
end
