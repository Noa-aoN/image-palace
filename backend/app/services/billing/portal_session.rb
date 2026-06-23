# frozen_string_literal: true

module Billing
  # 解約・支払い方法変更のための Stripe Customer Portal セッションを作成する。
  module PortalSession
    class MissingCustomer < StandardError; end

    module_function

    def call(user:, return_url:)
      raise MissingCustomer, "Stripe顧客がありません" if user.stripe_customer_id.blank?

      Stripe::BillingPortal::Session.create(customer: user.stripe_customer_id, return_url:)
    end
  end
end
