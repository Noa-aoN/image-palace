module Api
  module V1
    class HealthController < ApplicationController
      before_action :authenticate_user!, only: [:show_authenticated]

      def show
        render json: { status: 'ok', timestamp: Time.current }
      end

      def show_authenticated
        render json: {
          status: 'ok',
          user: current_user.email
        }
      end
    end
  end
end
