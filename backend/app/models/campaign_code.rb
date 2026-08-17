# frozen_string_literal: true

# 引き換えコード。運営が発行し、利用者が入力するとクレジットを受け取れる。
#
# 1人1回に固定している。回数を選べるようにすると、上限の扱いが
# 「1人あたり」と「全体」の2軸になって、運営が誤って配りすぎる。
# 同じ人に2回配りたい場合はコードを2枚出すほうが、意図が記録に残る。
class CampaignCode < ApplicationRecord
  # 配るもの。item は受け取り側の仕組みが未整備（GrantPolicy と同じ扱い）
  REWARD_TYPES = %w[credits item].freeze

  # 打ちやすさのために字種を絞る。0/O・1/I のような読み違えやすい組み合わせを避ける
  CODE_FORMAT = /\A[A-Z0-9]{4,32}\z/
  AMBIGUOUS = "01OI".chars.freeze
  CODE_ALPHABET = (("A".."Z").to_a + ("0".."9").to_a - AMBIGUOUS).freeze

  belongs_to :created_by, class_name: "User", optional: true
  has_many :redemptions, class_name: "CampaignRedemption", dependent: :destroy

  before_validation :normalize_code

  validates :code, presence: true, uniqueness: true, format: { with: CODE_FORMAT }
  validates :label, presence: true
  validates :reward_type, inclusion: { in: REWARD_TYPES }
  validates :amount, numericality: { only_integer: true, greater_than: 0 }
  validates :max_redemptions, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :credit_valid_days, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :period_must_be_forward
  validate :item_reward_not_ready

  scope :recent, -> { order(created_at: :desc) }
  # いま受け取れるものだけ。available? と同じ条件を SQL 側にも持つ
  # （使い切りの判定だけは件数を数えるので、ここには入れない）
  scope :redeemable, lambda { |now = Time.current|
    where(enabled: true)
      .where(starts_at: [ nil, ..now ])
      .where("expires_at IS NULL OR expires_at > ?", now)
  }

  # 大小を無視して探す。利用者は小文字で打つし、コピペで前後に空白が付く
  def self.lookup(raw)
    normalized = raw.to_s.strip.upcase
    return nil if normalized.blank?

    find_by(code: normalized)
  end

  # 読み違えにくい字だけで作る
  def self.generate_code(length: 8)
    Array.new(length) { CODE_ALPHABET.sample }.join
  end

  def points
    amount * Billing::POINTS_PER_CREDIT
  end

  def started?(now = Time.current)
    starts_at.blank? || starts_at <= now
  end

  def expired?(now = Time.current)
    expires_at.present? && expires_at <= now
  end

  def exhausted?
    max_redemptions.present? && redemptions.count >= max_redemptions
  end

  # いま受け取れるか。理由は呼び出し側で出し分けるので、ここでは真偽だけ
  def available?(now = Time.current)
    enabled? && started?(now) && !expired?(now) && !exhausted?
  end

  # 画面に出す状態。**「有効」と「期限内」は別のこと。**
  # enabled のまま期限が過ぎた行を「有効」とだけ出すと、配れると思い込む
  def status(now = Time.current)
    return "disabled" unless enabled?
    return "expired" if expired?(now)
    return "scheduled" unless started?(now)
    return "exhausted" if exhausted?

    "active"
  end

  # 配ったクレジットの有効期限
  def credit_expires_at(now = Time.current)
    return now + credit_valid_days.days if credit_valid_days.present?

    Billing::CreditExpiryPolicy.expires_at(now)
  end

  private

  def normalize_code
    self.code = code.to_s.strip.upcase.presence
  end

  def period_must_be_forward
    return if starts_at.blank? || expires_at.blank?
    return if starts_at < expires_at

    errors.add(:expires_at, "は開始より後にしてください")
  end

  # 受け取り側の仕組みができていないものを配ると、配ったのに届かない状態になる
  def item_reward_not_ready
    return unless reward_type == "item"
    return if GrantPolicy::READY_ITEM_KINDS.include?(item_kind)

    errors.add(:reward_type, "はまだ配れません（アイテムの受け取りが未対応）")
  end
end
