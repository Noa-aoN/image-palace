module Api
  module V1
    class HealthController < ApplicationController
      def show
        render json: { status: 'ok', timestamp: Time.current }
      end
    end
  end
end
