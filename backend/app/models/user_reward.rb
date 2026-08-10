# frozen_string_literal: true

# 獲得した称号・勲章・褒賞・表彰。
#
# 一度配ったものは消さない（運営が取り消すときだけ消える）。
# 定義を無効にしても、既に配ったものは残る。
class UserReward < ApplicationRecord
  SOURCES = %w[achievement mission manual campaign].freeze

  belongs_to :user
  belongs_to :reward_definition

  validates :source, inclusion: { in: SOURCES }
  validates :reward_definition_id, uniqueness: { scope: :user_id }

  scope :recent, -> { order(granted_at: :desc) }
  scope :featured, -> { where.not(featured_at: nil).order(:featured_at) }

  before_validation { self.granted_at ||= Time.current }
end
