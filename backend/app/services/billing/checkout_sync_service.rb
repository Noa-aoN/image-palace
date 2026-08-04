# frozen_string_literal: true

module Billing
  # 決済から戻ってきたときに、その場で支払いを取り込む。
  #
  # webhook だけに頼ると、届かない環境ではクレジットが一生増えない。
  # 実際、開発機で checkout すると webhook は本番へ飛ぶため、ローカルでは試せなかった。
  #
  # ここでは Stripe に直接「その決済はどうなったか」を聞き、支払い済みなら反映する。
  # webhook と同じ鍵（支払いそのものの id）で反映するので、両方走っても二重に増えない。
  # 本番でも、webhook が遅れた・落ちたときの取りこぼしを拾う役に立つ。
  class CheckoutSyncService
    class NotFound < StandardError; end
    class Forbidden < StandardError; end

    # 支払いが済んでいるとみなす状態（金額 0 の場合は no_payment_required になる）
    PAID_STATUSES = %w[paid no_payment_required].freeze
    # 決済 id が分からないときに遡って調べる件数
    RECENT_LIMIT = 10

    Result = Struct.new(:status, :applied, keyword_init: true)

    def self.call(user:, session_id:)
      new(user, session_id).call
    end

    def initialize(user, session_id)
      @user = user
      @session_id = session_id.to_s
    end

    def call
      return apply_recent! if @session_id.blank?

      session = retrieve
      authorize!(session)
      return Result.new(status: "unpaid", applied: false) unless paid?(session)

      Result.new(status: "paid", applied: apply!(session))
    end

    private

    # 決済 id が分からないときの受け皿。
    #
    # 戻り先の URL に id が載っていない（古い画面から戻った・リンクを踏み直した等）場合でも、
    # 「払ったのに増えない」を自力で直せるようにする。
    # 自分の顧客に紐づく決済だけを、直近から順に見る。反映済みのものは素通りする。
    def apply_recent!
      return Result.new(status: "no_customer", applied: false) if @user.stripe_customer_id.blank?

      sessions = Stripe::Checkout::Session.list(
        customer: @user.stripe_customer_id, limit: RECENT_LIMIT, expand: [ "data.subscription" ]
      )
      applied = sessions.data.count { |session| paid?(session) && apply!(session) }
      Result.new(status: applied.positive? ? "paid" : "nothing_to_apply", applied: applied.positive?)
    end

    def paid?(session)
      PAID_STATUSES.include?(session.payment_status.to_s)
    end

    def apply!(session)
      session.mode == "subscription" ? apply_subscription!(session) : apply_topup!(session)
    end

    def retrieve
      Stripe::Checkout::Session.retrieve(id: @session_id, expand: [ "subscription" ])
    rescue Stripe::InvalidRequestError => e
      raise NotFound, e.message
    end

    # 他人の決済 id を投げ込んでクレジットを引き出せないようにする。
    # 決済時に載せた client_reference_id か、こちらで持っている顧客 id のどちらかが一致すること。
    def authorize!(session)
      return if session.client_reference_id.to_s == @user.id.to_s
      return if @user.stripe_customer_id.present? && session.customer.to_s == @user.stripe_customer_id

      Rails.logger.warn "[stripe sync] FORBIDDEN user_id=#{@user.id} session=#{@session_id}"
      raise Forbidden, "この決済は別のアカウントのものです"
    end

    def apply_topup!(session)
      plan = Plan.find_by(name: session.metadata&.[]("plan_name"))
      return false if plan.nil?

      # 買い切りは checkout session の id をそのまま鍵にする（webhook 側と同じ）
      PaymentApplier.apply_topup!(user: @user, plan: plan, payment_key: session.id)
    end

    # サブスクは、契約そのものをこちらへ写してから、請求ぶんのクレジットを入れる。
    # webhook が来ない環境ではプランの反映もここでしか行われないため、両方やる。
    def apply_subscription!(session)
      stripe_subscription = session.subscription
      return false if stripe_subscription.blank?

      stripe_subscription = Stripe::Subscription.retrieve(stripe_subscription) if stripe_subscription.is_a?(String)
      SubscriptionSync.call(stripe_subscription, user: @user)

      invoice_id = stripe_subscription[:latest_invoice]
      invoice_id = invoice_id[:id] if invoice_id.respond_to?(:[]) && !invoice_id.is_a?(String)
      return false if invoice_id.blank?

      plan = Plan.find_by(stripe_price_id: stripe_subscription.items.data.first&.price&.id)
      PaymentApplier.apply_subscription_invoice!(
        user: @user, plan: plan,
        stripe_subscription_id: stripe_subscription.id, payment_key: invoice_id
      )
    end
  end
end
