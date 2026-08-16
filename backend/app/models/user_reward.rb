# frozen_string_literal: true

# 獲得した称号・勲章・宝物・表彰。
#
# 一度配ったものは行ごと消さない。手放したものは revoked_at で「持っていない」にする。
# 定義を無効にしても、既に配ったものは残る。
#
# **「いま持っている」は held を通す。** 素の where で引くと、
# 手放したものが所持扱いのまま画面に出る。
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

  # いま持っているもの。**所持を数える・見せる場面はすべてこれを通す**
  scope :held, -> { where(revoked_at: nil) }
  # 持っていたが、いまは持っていないもの（履歴として残っている）
  scope :revoked, -> { where.not(revoked_at: nil) }

  def held?
    revoked_at.nil?
  end

  # 手放す。行は消さず、飾っている状態だけ降ろす。
  # 降ろさないと、持っていないものが宮殿に並んだままになる
  def revoke!(now = Time.current)
    return false unless held?

    update!(revoked_at: now, equipped: false, room_placed: false, featured_at: nil)
  end

  # 取り戻す。**first_acquired_at は書き換えない**
  # （いつ初めて手にしたかは、取り直しても変わらない）
  def restore!(now = Time.current)
    return false if held?

    update!(revoked_at: nil, last_acquired_at: now, granted_at: now)
  end

  before_validation do
    self.granted_at ||= Time.current
    self.first_acquired_at ||= granted_at
    self.last_acquired_at ||= granted_at
  end
end
