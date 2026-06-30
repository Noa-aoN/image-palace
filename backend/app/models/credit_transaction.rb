class CreditTransaction < ApplicationRecord
  KINDS = %w[
    subscription_grant
    subscription_expire
    grant
    grant_expire
    topup_purchase
    consumption
    refund
    adjustment
  ].freeze

  belongs_to :user
  belongs_to :subscription, optional: true
  belongs_to :item, optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :delta, numericality: { only_integer: true }

  scope :recent, -> { order(created_at: :desc) }
end
