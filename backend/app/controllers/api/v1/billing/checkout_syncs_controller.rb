module Api
  module V1
    module Billing
      # 決済から戻ってきたときに、その場で支払いを取り込む。
      #
      # webhook だけに頼ると、届かない環境（開発機など）ではクレジットが一生増えない。
      # webhook と同じ鍵で反映するので、両方走っても二重には増えない。
      class CheckoutSyncsController < Api::V1::BaseController
        def create
          result = ::Billing::CheckoutSyncService.call(
            user: current_user, session_id: params[:session_id]
          )
          render json: { status: result.status, applied: result.applied }
        rescue ::Billing::CheckoutSyncService::Forbidden => e
          render json: { error: e.message }, status: :forbidden
        rescue ::Billing::CheckoutSyncService::NotFound => e
          render json: { error: e.message }, status: :not_found
        rescue Stripe::StripeError => e
          Rails.logger.warn "[stripe sync] failed user_id=#{current_user.id}: #{e.class}: #{e.message}"
          render json: { error: "決済の確認に失敗しました。時間を置いて再度お試しください。" },
                 status: :unprocessable_entity
        end
      end
    end
  end
end
