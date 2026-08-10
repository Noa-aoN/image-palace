# frozen_string_literal: true

# 引き換えコードを受け取った記録。1人1回で、あとから消さない。
#
# 配ったポイントを持たせているのは、コードの条件を後から変えても
# 「そのとき何を配ったか」が動かないようにするため。
class CampaignRedemption < ApplicationRecord
  self.record_timestamps = false

  belongs_to :campaign_code, counter_cache: false
  belongs_to :user

  validates :points, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  before_validation { self.created_at ||= Time.current }
end
