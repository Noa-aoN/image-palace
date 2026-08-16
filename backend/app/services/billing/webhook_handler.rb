# frozen_string_literal: true

module Billing
  # Stripe Webhook を署名検証してから種別ごとに処理する。
  # クレジット付与系は credit_transactions.stripe_event_id（unique）で冪等にする。
  class WebhookHandler
    class SignatureError < StandardError; end

    def self.call(...)
      new(...).call
    end

    # 署名シークレットは起動時に決めたものを使う（API キーと同じモードのもの）。
    # ここで ENV を直に見ると、鍵とシークレットのモードが食い違っても気づけない
    def initialize(payload:, signature:, secret: Billing::KeySelection.webhook_secret)
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
      when "refund.created"
        record_refund(event)
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

      # **没収しない。** クレジットは出どころによらず「付与から3か月」で、
      # 規約にもそう書いてある。解約を理由に取り上げると、受け取った対価を
      # こちらの都合で消すことになる。
      #
      # 残っているぶんは繰り越しの入れ物へ移し、期限が来たら自然に失効する
      # （ExpireCreditGrantsJob が拾う）。月々の付与はここで止まる。
      sub.user.reset_subscription_credits!(0, subscription: sub)
      sub.update!(status: "canceled", canceled_at: Time.current)

      # 契約が終わったので、位も外れる。この道だけは SubscriptionSync を通らない
      # （Stripe の姿を写すのではなく、こちらで終わりを確定させている）ので、ここで呼ぶ
      ::Achievements::SyncPlanTitle.sync_quietly(user: sub.user)
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
    # 返金を記録する。**クレジットは触らない。**
    #
    # 自動で戻すには、まだ足りないものが多い。
    #   ・使い切ったぶんをどう扱うかは、事業としての判断が要る
    #   ・部分返金の按分も同じ
    #   ・誤って戻すほうが、手で直すより危ない
    #
    # いま塞ぎたいのは「**返金に気づかない**」という一点だけ。
    # 台帳に残し、運営に知らせて、そこで人が判断する。
    #
    # 金額は `amount_cents` に**負で**入れる。集計側は「返金」の行を
    # 売上（Gross）から外したうえで、ここを合計して Refunds を出す。
    # **Gross の意味は変えない**（既存の数字と互換を保つ）。
    def record_refund(event)
      refund = event.data.object
      note = refund_note(refund)
      user = user_for_refund(refund)

      # 宛先が分からなくても黙って捨てない。**気づけないことがいちばん困る**
      if user.nil?
        notify_operator!("REFUND 宛先不明 event=#{event.id} #{note}")
        return nil
      end

      CreditTransaction.create!(
        user: user, kind: "refund", delta: 0,
        # **鍵は返金そのものの id。** イベントの id にすると、種別の違う出来事
        # （refund.created と refund.updated など）が同じ返金で別々に積まれる
        stripe_event_id: refund[:id],
        currency: refund[:currency],
        # **負で入れる。** 集計側は「返金」の行を売上（Gross）から外したうえで、
        # ここを合計して Refunds を出す。文字の中に額があるだけだと機械が読めない
        amount_cents: -refund[:amount].to_i,
        livemode: refund[:livemode].nil? ? Billing::Mode.live? : refund[:livemode],
        description: note
      )

      notify_operator!(
        "REFUND user_id=#{user.id} #{note} （クレジットは自動で戻していない。手当てが要るか確認すること）"
      )
      nil
    rescue ActiveRecord::RecordNotUnique
      # 同じ返金の再配信。2度目は何もしない（stripe_event_id の一意制約が受け止める）
      nil
    end

    # 台帳に残す一行。**あとから人が読んで判断できる**ことを優先する。
    # status も残す。返金は後から失敗しうるので、何の状態で受けたかが要る
    def refund_note(refund)
      [
        "返金 #{refund[:amount].to_i} #{refund[:currency].to_s.upcase}",
        "status=#{refund[:status].presence || '不明'}",
        refund[:reason].present? ? "reason=#{refund[:reason]}" : nil,
        refund[:charge].present? ? "charge=#{refund[:charge]}" : nil,
        refund[:payment_intent].present? ? "payment_intent=#{refund[:payment_intent]}" : nil
      ].compact.join(" / ")
    end

    # Refund は顧客を持たない。元の決済まで辿って突き止める。
    # 辿れなくても落とさない（宛先不明として知らせる）
    def user_for_refund(refund)
      charge_id = refund[:charge]
      return nil if charge_id.blank?

      charge = Stripe::Charge.retrieve(charge_id)
      user_for(charge[:customer])
    rescue StandardError => e
      Rails.logger.warn("[stripe webhook] 返金の元決済を辿れず: #{e.class}")
      nil
    end

    def notify_operator!(message)
      full = "[stripe webhook] #{message}"
      Rails.logger.error(full)
      Sentry.capture_message(full, level: :error) if defined?(Sentry)
    end

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
