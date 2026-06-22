class Plan < ApplicationRecord
  KINDS = %w[subscription one_time].freeze
  TIERS = %w[free standard pro creator studio topup].freeze

  has_many :subscriptions, dependent: :restrict_with_exception

  validates :name, presence: true, uniqueness: true
  validates :kind, inclusion: { in: KINDS }
  validates :currency, presence: true
  validates :credits_per_period, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :price_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true

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
end
