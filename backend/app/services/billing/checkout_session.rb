# frozen_string_literal: true

module Billing
  # プランに対応する Stripe Checkout Session を作成する。
  # subscription プランは定期課金、one_time（Top-up）は単発決済。
  class CheckoutSession
    class MissingPriceId < StandardError; end

    def self.call(...)
      new(...).call
    end

    def initialize(user:, plan:, success_url:, cancel_url:)
      @user = user
      @plan = plan
      @success_url = success_url
      @cancel_url = cancel_url
    end

    def call
      raise MissingPriceId, "plan に stripe_price_id がありません: #{@plan.name}" if @plan.stripe_price_id.blank?

      Stripe::Checkout::Session.create(
        mode: @plan.subscription? ? "subscription" : "payment",
        customer: Billing::Customers.ensure(@user),
        client_reference_id: @user.id,
        line_items: [ { price: @plan.stripe_price_id, quantity: 1 } ],
        success_url: with_session_id(@success_url),
        cancel_url: @cancel_url,
        metadata: { plan_name: @plan.name }
      )
    end

    private

    # 戻り先に決済 id を載せる。webhook が届かなくても、戻った画面から
    # 「その決済はどうなったか」を Stripe に聞いて反映できるようにする。
    # {CHECKOUT_SESSION_ID} は Stripe が実際の id に差し替える決まり文句。
    def with_session_id(url)
      separator = url.include?("?") ? "&" : "?"
      "#{url}#{separator}session_id={CHECKOUT_SESSION_ID}"
    end
  end
end
