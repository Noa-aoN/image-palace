# frozen_string_literal: true

module Billing
  # Stripe のサブスクリプションを、こちらの Subscription へ写す。
  #
  # webhook（customer.subscription.created/updated）と、
  # 決済から戻ったときの取り込み（CheckoutSyncService）の両方から呼ぶ。
  # 片方だけを直して挙動がずれるのを避けるため、1か所にまとめる。
  module SubscriptionSync
    module_function

    # stripe_subscription: Stripe::Subscription（webhook の data.object でも可）
    def call(stripe_subscription, user:)
      return nil if stripe_subscription.nil? || user.nil?

      line = stripe_subscription.items.data.first
      plan = Plan.find_by(stripe_price_id: line&.price&.id)

      subscription = Subscription.find_or_initialize_by(stripe_subscription_id: stripe_subscription.id)
      subscription.user = user
      subscription.plan = plan if plan
      subscription.stripe_customer_id = stripe_subscription.customer
      subscription.status = stripe_subscription.status
      # Stripe API 2025-03-31 以降は current_period_* が Subscription 直下から items 配下へ移動した。
      # 旧/新どちらの形でも取得できるようフォールバックする。
      # ※ Stripe オブジェクトは未知メソッドで NoMethodError を投げるため、必ず [] でアクセスする。
      subscription.current_period_start = time_at(period_value(stripe_subscription, line, :current_period_start))
      subscription.current_period_end = time_at(period_value(stripe_subscription, line, :current_period_end))
      subscription.cancel_at_period_end = cancelling?(stripe_subscription)
      subscription.canceled_at = time_at(stripe_subscription.canceled_at)
      subscription.started_at ||= Time.current
      # テストで作った契約を「有料契約」に数えないための目印。
      # Stripe 側の値があればそれを、無ければいまの鍵で判断する
      subscription.livemode = stripe_subscription[:livemode].nil? ? Billing::Mode.live? : stripe_subscription[:livemode]
      subscription.save!
      subscription
    end

    # 解約が予約されているか。
    #
    # **`cancel_at_period_end` だけでは足りない。** お支払い管理ページからの解約では、
    # Stripe が「その日に終わらせる」形（`cancel_at` に期末の時刻）で予約し、
    # 真偽値のほうは false のままになることがある。
    # 真偽値だけを写していると、**利用者が解約したのに画面には何も出ない**まま
    # 期末を迎えることになる（本番の実地検証で実際にこうなった）。
    #
    # 予約日そのものは列に持たない。画面に出しているのは期間の終わりで、
    # お支払い管理ページから予約できるのも期末だけなので、いまは真偽値で足りる。
    def cancelling?(stripe_subscription)
      return true if stripe_subscription.cancel_at_period_end

      stripe_subscription[:cancel_at].present?
    end

    # current_period_* は Subscription 直下（旧API）か items 配下（新API）のどちらか。
    # Stripe オブジェクトは [] なら未設定キーで nil を返す（直メソッドは NoMethodError）。
    def period_value(subscription, line, key)
      subscription[key] || (line && line[key])
    end

    def time_at(unix)
      unix && Time.at(unix)
    end
  end
end
