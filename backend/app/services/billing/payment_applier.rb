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

      # Free→Paid で無料枠の引き継ぎ（free_carryover）は**行わない**。
      #
      # 無料枠は `credit_grants`（kind: trial / monthly_free）に期限付き（CreditExpiryPolicy）で積まれ、
      # 有料化しても失効しない（ここで触るのは subscription_credits だけ。
      # grant を失効させるのは解約時の forfeit ではなく、期限切れの日次ジョブ）。
      # **つまり「使い残しを失効させない」という目的は grant 方式が既に満たしている。**
      # ここで改めて引き継ぐと、生き残っている grant を二重に数えることになる。
      # 経緯は docs/decisions/credit-model.md 末尾の追記を参照。
      #
      # subscription を渡し、paid の付与ログとして残す。
      local_sub = Subscription.find_by(stripe_subscription_id: stripe_subscription_id)
      if local_sub.nil?
        # invoice.paid が customer.subscription.created より先に届いた形。付与は続けてよいが、
        # 紐付けの無いログが残るため、後から追えるように残す（頻発するなら配信順を疑う）。
        Rails.logger.warn(
          "[PaymentApplier] local subscription not found stripe_subscription_id=#{stripe_subscription_id} " \
          "user_id=#{user.id}"
        )
      end
      user.reset_subscription_credits!(
        plan.credits_per_period * Billing::POINTS_PER_CREDIT,
        subscription: local_sub, stripe_event_id: payment_key,
        amount_cents: plan.price_cents, currency: plan.currency
      )
      true
    end
  end
end
