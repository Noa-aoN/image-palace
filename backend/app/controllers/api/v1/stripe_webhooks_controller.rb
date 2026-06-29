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
      rescue ::Billing::WebhookHandler::SignatureError => e
        # 署名検証失敗は無言だと原因不明になりがち（例: STRIPE_WEBHOOK_SECRET 未設定/不一致）。
        # 秘密情報は出さず、設定有無と理由だけ記録する。
        Rails.logger.warn(
          "[stripe webhook] signature verification failed " \
          "(STRIPE_WEBHOOK_SECRET set?=#{ENV['STRIPE_WEBHOOK_SECRET'].present?}): #{e.message}"
        )
        head :bad_request
      rescue StandardError => e
        # 処理失敗時は 422 を返し Stripe にリトライさせる（恒久失敗の握り潰しを避ける）
        Rails.logger.error("[stripe webhook] #{e.class}: #{e.message}")
        head :unprocessable_entity
      end
    end
  end
end
