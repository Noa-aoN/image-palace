# frozen_string_literal: true

module Billing
  # 支払い1件ぶんのクレジットを反映する。
  #
  # 反映の入口は2つある。
  #   1. Stripe からの webhook
  #   2. 決済から戻ってきたときの取り込み（CheckoutSyncService）
  #
  # 同じ支払いが両方から来ても二重に増えないよう、**支払いそのものの id** を鍵にする。
  # イベント id を鍵にすると、同じ支払いでも入口ごとに別の鍵になり二重に増えてしまう。
  #   - 買い切り: checkout session の id（cs_...）
  #   - サブスク: invoice の id（in_...）
  module PaymentApplier
    module_function

    def applied?(payment_key)
      payment_key.present? && CreditTransaction.exists?(stripe_event_id: payment_key)
    end

    # 買い切り（Top-up）。反映したら true
    def apply_topup!(user:, plan:, payment_key:)
      return false if user.nil? || plan.nil? || applied?(payment_key)

      user.add_topup_credits!(
        plan.credits_per_period * Billing::POINTS_PER_CREDIT, stripe_event_id: payment_key,
        amount_cents: plan.price_cents, currency: plan.currency
      )
      true
    end

    # サブスクの請求成功（初回＋毎月）。当月分にリセット付与する
    def apply_subscription_invoice!(user:, plan:, stripe_subscription_id:, payment_key:)
      return false if user.nil? || plan.nil? || applied?(payment_key)

      # Free→Paid 初回切替時、失効させずに Free 残高を「期限付きグラント」として引き継ぐ。
      carry_over_free_balance!(user) if first_paid_grant?(user)
      # subscription を渡し、paid の付与ログ（subscription_id 付き）として残す＝以降の初回判定に使う。
      local_sub = Subscription.find_by(stripe_subscription_id: stripe_subscription_id)
      user.reset_subscription_credits!(
        plan.credits_per_period * Billing::POINTS_PER_CREDIT,
        subscription: local_sub, stripe_event_id: payment_key,
        amount_cents: plan.price_cents, currency: plan.currency
      )
      true
    end

    # 「初回の有料化」判定：free_carryover グラント未付与 かつ
    # paid の subscription_grant（subscription_id 付き）が無い。
    def first_paid_grant?(user)
      user.credit_grants.where(kind: "free_carryover").none? &&
        user.credit_transactions.where(kind: "subscription_grant").where.not(subscription_id: nil).none?
    end

    # 現在の Free 残高（subscription_credits に保持）を、上限=Free月間枠・期限=元のFree周期末で引き継ぐ。
    def carry_over_free_balance!(user)
      free_quota_points = Plan.find_by(name: "free")&.credits_per_period.to_i * Billing::POINTS_PER_CREDIT
      carry = [ user.subscription_credits, free_quota_points ].min
      return if carry <= 0

      user.grant_credits!(carry, kind: "free_carryover", expires_at: user.next_free_credit_reset_at)
    end
  end
end
