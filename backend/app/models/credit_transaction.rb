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

  # 明細に出すときの日本語表記。増える理由と減る理由が一目で分かるようにする
  LABELS = {
    "subscription_grant" => "プランの付与",
    "subscription_expire" => "プラン分の失効",
    "grant" => "ボーナス付与",
    "grant_expire" => "ボーナスの失効",
    "topup_purchase" => "クレジット購入",
    "consumption" => "生成で使用",
    "refund" => "返金",
    "adjustment" => "調整"
  }.freeze

  scope :recent, -> { order(created_at: :desc) }

  def label
    LABELS[kind] || kind
  end

  # 表示用クレジット（1cr = POINTS_PER_CREDIT pt）。符号はそのまま残す
  def credits
    delta.fdiv(Billing::POINTS_PER_CREDIT)
  end
end
