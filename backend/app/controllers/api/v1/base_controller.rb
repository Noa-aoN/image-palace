module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def not_found
        render json: { error: "Not found" }, status: :not_found
      end

      def bad_request(e)
        render json: { error: e.message }, status: :bad_request
      end
    end
  end
end
