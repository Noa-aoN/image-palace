class Subscription < ApplicationRecord
  # Stripe の subscription.status に準拠
  STATUSES = %w[active trialing past_due canceled incomplete incomplete_expired unpaid paused].freeze

  belongs_to :user
  belongs_to :plan

  validates :status, inclusion: { in: STATUSES }, allow_nil: true
  validates :stripe_subscription_id, uniqueness: true, allow_nil: true

  scope :active, -> { where(status: "active") }

  def active?
    status == "active"
  end
end
