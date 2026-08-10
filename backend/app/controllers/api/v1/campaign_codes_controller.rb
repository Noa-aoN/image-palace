module Api
  module V1
    # 引き換えコードの受け取り。
    class CampaignCodesController < BaseController
      def redeem
        result = ::Billing::RedeemCampaignCode.call(user: current_user, code: params[:code])

        render json: {
          credits: result.credits,
          label: result.label,
          expires_at: result.expires_at,
          # 受け取り直後の残高。画面が別途問い合わせなくて済む
          available_credits: current_user.reload.available_credits
        }, status: :ok
      rescue ::Billing::RedeemCampaignCode::Error => e
        render json: { error: e.message }, status: :unprocessable_entity
      end
    end
  end
end
