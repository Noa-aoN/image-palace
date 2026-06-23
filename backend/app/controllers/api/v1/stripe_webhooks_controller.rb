module Api
  module V1
    # Stripe Webhook の受け口（認証不要・署名検証で正当性を担保）。
    # BaseController ではなく ApplicationController を継承し、authenticate_user! を通さない。
    class StripeWebhooksController < ApplicationController
      def create
        ::Billing::WebhookHandler.call(
          payload: request.body.read,
          signature: request.env["HTTP_STRIPE_SIGNATURE"]
        )
        head :ok
      rescue ::Billing::WebhookHandler::SignatureError
        head :bad_request
      rescue StandardError => e
        # 処理失敗時は 422 を返し Stripe にリトライさせる（恒久失敗の握り潰しを避ける）
        Rails.logger.error("[stripe webhook] #{e.class}: #{e.message}")
        head :unprocessable_entity
      end
    end
  end
end
