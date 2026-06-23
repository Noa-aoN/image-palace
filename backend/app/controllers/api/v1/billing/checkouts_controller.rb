module Api
  module V1
    module Billing
      # プランを選んで Stripe Checkout を開始する。決済画面のURLを返す。
      class CheckoutsController < Api::V1::BaseController
        def create
          plan = Plan.active.find_by!(name: params.require(:plan))
          session = ::Billing::CheckoutSession.call(
            user: current_user,
            plan: plan,
            success_url: params[:success_url].presence || default_url("/account?checkout=success"),
            cancel_url: params[:cancel_url].presence || default_url("/account?checkout=cancel")
          )
          render json: { url: session.url }
        rescue ::Billing::CheckoutSession::MissingPriceId => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def default_url(path)
          "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}#{path}"
        end
      end
    end
  end
end
