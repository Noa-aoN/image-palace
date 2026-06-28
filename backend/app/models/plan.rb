class Plan < ApplicationRecord
  KINDS = %w[subscription one_time].freeze
  TIERS = %w[free standard pro creator studio topup].freeze

  has_many :subscriptions, dependent: :restrict_with_exception

  validates :name, presence: true, uniqueness: true
  validates :kind, inclusion: { in: KINDS }
  validates :currency, presence: true
  validates :credits_per_period, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :price_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validate :no_annual_subscription_until_supported

  scope :active, -> { where(active: true) }
  scope :subscriptions_kind, -> { where(kind: "subscription") }
  scope :one_time, -> { where(kind: "one_time") }

  def subscription?
    kind == "subscription"
  end

  def one_time?
    kind == "one_time"
  end

  def free?
    price_cents.to_i.zero?
  end

  private

  # 年額サブスクは invoice.paid が周期1回のため「年1回しか付与されない」。
  # 月次付与の定期ジョブを実装するまで導入を禁止する（休眠中の安全策）。
  def no_annual_subscription_until_supported
    return unless subscription? && interval == "year"

    errors.add(:interval, "年額サブスクは月次付与の実装まで未対応です")
  end
end
