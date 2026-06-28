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
      return unless user && plan
      return if processed?(event)

      user.add_topup_credits!(plan.credits_per_period * Billing::POINTS_PER_CREDIT, stripe_event_id: event.id)
    end

    def sync_subscription(event)
      obj = event.data.object
      user = user_for(obj.customer)
      return unless user

      plan = Plan.find_by(stripe_price_id: obj.items.data.first&.price&.id)
      sub = Subscription.find_or_initialize_by(stripe_subscription_id: obj.id)
      sub.user = user
      sub.plan = plan if plan
      sub.stripe_customer_id = obj.customer
      sub.status = obj.status
      sub.current_period_start = time_at(obj.current_period_start)
      sub.current_period_end = time_at(obj.current_period_end)
      sub.cancel_at_period_end = obj.cancel_at_period_end
      sub.canceled_at = time_at(obj.canceled_at)
      sub.started_at ||= Time.current
      sub.save!
      sub
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
      return if invoice.subscription.blank?

      user = user_for(invoice.customer)
      plan = Plan.find_by(stripe_price_id: invoice.lines.data.first&.price&.id)
      return unless user && plan
      return if processed?(event)

      user.reset_subscription_credits!(plan.credits_per_period * Billing::POINTS_PER_CREDIT, stripe_event_id: event.id)
    end

    def user_for(customer_id, client_reference_id = nil)
      User.find_by(stripe_customer_id: customer_id) ||
        (client_reference_id.present? ? User.find_by(id: client_reference_id) : nil)
    end

    def processed?(event)
      CreditTransaction.exists?(stripe_event_id: event.id)
    end

    def time_at(unix)
      unix && Time.at(unix)
    end
  end
end
