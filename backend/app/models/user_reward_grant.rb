# frozen_string_literal: true

# 獲得物を受け取った1回ぶんの記録。
#
# `UserReward` が「いま何を持っているか」なのに対し、こちらは「いつ・なぜ受け取ったか」。
# 宝物を複数持てるようにすると、**何個目がどの出来事で来たのか**が分からなくなる。
#
# **同じ出来事から2回配らない**ための鍵（event_key）もここが持つ。
# 数量だけを見ていると「正しい複数付与」と「再送による二重付与」は区別が付かない。
class UserRewardGrant < ApplicationRecord
  belongs_to :user
  belongs_to :reward_definition

  validates :source, inclusion: { in: UserReward::SOURCES }

  scope :recent, -> { order(granted_at: :desc) }

  before_validation { self.granted_at ||= Time.current }
end
