# frozen_string_literal: true

module Billing
  # ユーザーに対応する Stripe Customer を保証する（無ければ作成して保存）。
  module Customers
    module_function

    def ensure(user)
      existing = user.stripe_customer_id
      return existing if existing.present? && alive?(existing)

      customer = Stripe::Customer.create(email: user.email, metadata: { user_id: user.id })
      user.update!(stripe_customer_id: customer.id)
      customer.id
    end

    # その顧客が、いまの鍵から見えるか。
    #
    # **持っている id をそのまま信じない。** テストモードで作った顧客は
    # Live からは引けず、その id で決済を始めようとすると "No such customer" で落ちる。
    # 決済画面にすら進めない形になり、利用者からは原因が分からない。
    #
    # 見えないときは作り直す（消された顧客も同じ扱いでよい）。
    # 通信そのものが失敗したときは、既にある id を信じる側に倒す
    # （一時的な不調で顧客を増やし続けないため）。
    def alive?(customer_id)
      Stripe::Customer.retrieve(customer_id)
      true
    rescue Stripe::InvalidRequestError
      false
    rescue Stripe::StripeError
      true
    end
  end
end
