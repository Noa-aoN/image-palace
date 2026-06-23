# frozen_string_literal: true

module Billing
  # ユーザーに対応する Stripe Customer を保証する（無ければ作成して保存）。
  module Customers
    module_function

    def ensure(user)
      return user.stripe_customer_id if user.stripe_customer_id.present?

      customer = Stripe::Customer.create(email: user.email, metadata: { user_id: user.id })
      user.update!(stripe_customer_id: customer.id)
      customer.id
    end
  end
end
