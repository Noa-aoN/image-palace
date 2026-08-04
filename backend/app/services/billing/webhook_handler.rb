# frozen_string_literal: true

module Billing
  # Stripe Webhook を署名検証してから種別ごとに処理する。
  # クレジット付与系は credit_transactions.stripe_event_id（unique）で冪等にする。
  class WebhookHandler
    class SignatureError < StandardError; end

    def self.call(...)
      new(...).call
    end

    def initialize(payload:, signature:, secret: ENV["STRIPE_WEBHOOK_SECRET"])
      @payload = payload
      @signature = signature
      @secret = secret
    end

    def call
      event = verify!

      case event.type
      when "checkout.session.completed"
        handle_checkout_completed(event)
      when "customer.subscription.created"
        sub = sync_subscription(event)
        grant_trial_credits(event, sub)
      when "customer.subscription.updated"
        sync_subscription(event)
      when "customer.subscription.deleted"
        cancel_subscription(event)
      when "invoice.paid"
        grant_subscription_credits(event)
      end

      event.type
    end

    private

    def verify!
      Stripe::Webhook.construct_event(@payload, @signature, @secret)
    rescue Stripe::SignatureVerificationError => e
      raise SignatureError, e.message
    end

    # one_time（Top-up）の支払い完了でクレジットを加算する。
    # subscription の初回/更新分は invoice.paid 側で付与する。
    def handle_checkout_completed(event)
      session = event.data.object
      return unless session.mode == "payment"

      user = user_for(session.customer, session.client_reference_id)
      plan = Plan.find_by(name: session.metadata&.[]("plan_name"))
      unless user && plan
        return report_unmatched!(
          event,
          user: user, plan: plan,
          customer: session.customer, client_reference_id: session.client_reference_id
        )
      end

      # 鍵は支払いそのものの id。決済から戻ったときの取り込みと同じ鍵にして二重付与を防ぐ
      # Stripe オブジェクトは未知メソッドで NoMethodError を投げるため、必ず [] でアクセスする
      PaymentApplier.apply_topup!(user: user, plan: plan, payment_key: session[:id] || event.id)
    end

    def sync_subscription(event)
      obj = event.data.object
      user = user_for(obj.customer)
      return unless user

      SubscriptionSync.call(obj, user: user)
    end

    # trial 開始時にクレジットを付与する（trial 中も生成できるように）。
    # created イベント1回で付与し、stripe_event_id で冪等化する。
    # 注: Stripe が trial 中に $0 invoice.paid も送る構成では、reset 同額のため残高は二重にならない。
    def grant_trial_credits(event, sub)
      return unless sub&.status == "trialing" && sub.plan
      return if processed?(event)

      sub.user.reset_subscription_credits!(
        sub.plan.credits_per_period * Billing::POINTS_PER_CREDIT,
        subscription: sub, stripe_event_id: event.id
      )
    end

    # 解約確定時に、残っているサブスククレジットを失効させる（解約後に使い回せる穴を塞ぐ）。
    # 冪等性は status=="canceled" の早期 return で担保する（再配信でも二重失効しない）。
    def cancel_subscription(event)
      sub = Subscription.find_by(stripe_subscription_id: event.data.object.id)
      return unless sub
      return if sub.status == "canceled"

      sub.user.reset_subscription_credits!(0, subscription: sub)
      sub.update!(status: "canceled", canceled_at: Time.current)
    end

    # サブスクの請求成功（初回＋毎月）でクレジットを当月分にリセット付与する。
    def grant_subscription_credits(event)
      invoice = event.data.object
      stripe_sub_id = invoice_subscription_id(invoice)
      return if stripe_sub_id.blank?

      user = user_for(invoice.customer)
      plan = Plan.find_by(stripe_price_id: invoice_price_id(invoice))
      unless user && plan
        return report_unmatched!(event, user: user, plan: plan, customer: invoice.customer)
      end
      return if processed?(event)

      # 鍵は請求そのものの id。決済から戻ったときの取り込みと同じ鍵にして二重付与を防ぐ
      PaymentApplier.apply_subscription_invoice!(
        user: user, plan: plan,
        stripe_subscription_id: stripe_sub_id, payment_key: invoice[:id] || event.id
      )
    end

    # Stripe API 2025-03 以降、invoice.subscription は parent.subscription_details.subscription へ移動した。
    # Stripe オブジェクトは未知メソッドで NoMethodError を投げるため、必ず [] でアクセスする。
    def invoice_subscription_id(invoice)
      invoice[:subscription] || invoice[:parent]&.[](:subscription_details)&.[](:subscription)
    end

    # 明細の price も line.price → line.pricing.price_details.price へ移動した。両対応で price_id を取る。
    def invoice_price_id(invoice)
      line = invoice.lines.data.first
      return nil unless line

      (line[:price] && line[:price][:id]) || line[:pricing]&.[](:price_details)&.[](:price)
    end

    def user_for(customer_id, client_reference_id = nil)
      User.find_by(stripe_customer_id: customer_id) ||
        (client_reference_id.present? ? User.find_by(id: client_reference_id) : nil)
    end

    def processed?(event)
      CreditTransaction.exists?(stripe_event_id: event.id)
    end

    # 支払いは済んでいるのに、宛先のユーザーかプランが特定できなかった。
    #
    # ここを黙って通すと「払ったのにクレジットが増えない」が誰にも気づかれないまま残る。
    # 実際、開発機で checkout して webhook だけ本番に届く構成だとこれが起きる。
    #
    # 200 は返し続ける（Stripe に再送させても永久に一致しないため）が、
    # 必ずログと Sentry に出して、後から手当てできるようにする。
    # 個人情報は載せない（顧客IDとイベントIDだけで Stripe 側から辿れる）。
    def report_unmatched!(event, user:, plan:, customer: nil, client_reference_id: nil)
      reason = [ ("user" if user.nil?), ("plan" if plan.nil?) ].compact.join("+")
      message = "[stripe webhook] UNMATCHED #{reason} type=#{event.type} event=#{event.id} " \
                "customer=#{customer} client_reference_id=#{client_reference_id}"
      Rails.logger.error(message)
      Sentry.capture_message(message, level: :error) if defined?(Sentry)
      nil
    end
  end
end
