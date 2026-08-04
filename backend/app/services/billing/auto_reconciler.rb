# frozen_string_literal: true

module Billing
  # 残高を見にきたときに、Stripe と自動で突き合わせる。
  #
  # webhook は届かない・遅れる・落ちることがある。そのたびに人手で直すのは
  # 運営として成り立たないので、利用者が気づく前にこちらで拾う。
  #
  # ただし毎回 Stripe を叩くと遅く高くつく。最後に確認した時刻を持ち、
  # 間隔を空けて確認する。確認そのものが失敗しても残高表示は止めない。
  module AutoReconciler
    module_function

    # 同じ人について、これより短い間隔では確認しない
    INTERVAL = 10.minutes
    # 支払い直後は待たずに確認する（決済から戻った直後を取りこぼさないため）
    FRESH_CUSTOMER_WINDOW = 1.hour

    def call(user)
      return false unless due?(user)

      # 先に時刻を進めておく。確認が失敗しても、続けて叩き続けないようにする
      user.update_column(:stripe_reconciled_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
      CheckoutSyncService.call(user: user, session_id: nil).applied
    rescue Stripe::StripeError, Faraday::Error => e
      # 突き合わせに失敗しても残高表示は止めない（見られなくなる方が困る）
      Rails.logger.warn "[stripe reconcile] failed user_id=#{user.id}: #{e.class}: #{e.message}"
      false
    end

    def due?(user)
      return false if user.stripe_customer_id.blank?
      return true if user.stripe_reconciled_at.blank?

      user.stripe_reconciled_at <= INTERVAL.ago
    end
  end
end
