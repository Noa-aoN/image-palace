class CreditGrant < ApplicationRecord
  # 期限付きクレジット（Free引き継ぎ・キャンペーン等）。残量が0になるか期限切れで無効。
  # trial: 登録時のお試し枠（1アカウント1回）
  # topup: 買い切りで購入したぶん（期限付き）
  KINDS = %w[trial monthly_free topup free_carryover subscription_carryover campaign goodwill].freeze

  belongs_to :user

  validates :kind, presence: true
  validates :amount_points, :remaining_points,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # 残量あり かつ 未期限切れ（期限なしも有効）
  scope :active, -> { where("remaining_points > 0 AND (expires_at IS NULL OR expires_at > ?)", Time.current) }
  # 消費順：期限が近いものから（期限なしは最後）
  scope :consume_order, -> { active.order(Arel.sql("expires_at ASC NULLS LAST")) }
end
