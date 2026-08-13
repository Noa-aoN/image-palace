# frozen_string_literal: true

# 獲得した称号・勲章・宝物・表彰。
#
# 一度配ったものは消さない（運営が取り消すときだけ消える）。
# 定義を無効にしても、既に配ったものは残る。
#
# **1人1定義1行のまま**。同じ宝物を複数持つときは行を増やさず quantity を増やす。
# 行を増やす形にすると、飾る・掲げるといった状態（equipped / featured_at /
# room_placed）をどの行が持つのかが決められなくなる。
#
# 「いつ・なぜ受け取ったか」は UserRewardGrant が1回ぶんずつ持つ。
class UserReward < ApplicationRecord
  SOURCES = %w[achievement mission manual campaign].freeze

  belongs_to :user
  belongs_to :reward_definition

  validates :source, inclusion: { in: SOURCES }
  validates :reward_definition_id, uniqueness: { scope: :user_id }

  has_many :grants, -> { order(granted_at: :desc) },
           class_name: "UserRewardGrant",
           primary_key: :reward_definition_id, foreign_key: :reward_definition_id,
           inverse_of: false, dependent: nil

  validates :quantity, numericality: { only_integer: true, greater_than: 0 }

  scope :recent, -> { order(granted_at: :desc) }
  scope :featured, -> { where.not(featured_at: nil).order(:featured_at) }

  before_validation do
    self.granted_at ||= Time.current
    self.first_acquired_at ||= granted_at
    self.last_acquired_at ||= granted_at
  end
end
