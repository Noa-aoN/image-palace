module Api
  module V1
    module Billing
      # 解約・支払い変更のための Stripe Customer Portal を開く。URLを返す。
      class PortalsController < Api::V1::BaseController
        def create
          session = ::Billing::PortalSession.call(
            user: current_user,
            return_url: params[:return_url].presence || "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/account"
          )
          render json: { url: session.url }
        rescue ::Billing::PortalSession::MissingCustomer => e
          render json: { error: e.message }, status: :unprocessable_entity
        end
      end
    end
  end
end
