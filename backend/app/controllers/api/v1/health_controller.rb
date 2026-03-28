module Api
  module V1
    class HealthController < ApplicationController
      before_action :authenticate_api_v1_user!, only: [:show_authenticated]

      def show
        render json: { status: 'ok', timestamp: Time.current }
      end

      def show_authenticated
        render json: {
          status: 'ok',
          user: {
            id: current_api_v1_user.id,
            email: current_api_v1_user.email,
            provider: current_api_v1_user.provider,
            uid: current_api_v1_user.uid
          }
        }
      end
    end
  end
end
