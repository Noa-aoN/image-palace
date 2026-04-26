# frozen_string_literal: true

module Api
  module V1
    module Auth
      class RegistrationsController < DeviseTokenAuth::RegistrationsController
        before_action :set_default_confirm_success_url, only: :create

        private

        def build_resource
          super
          auto_confirm_email_signup!
        end

        def set_default_confirm_success_url
          return if params[:confirm_success_url].present?

          params[:confirm_success_url] = default_confirm_success_url
        end

        def auto_confirm_email_signup!
          return unless @resource.respond_to?(:skip_confirmation!)
          return unless @resource.provider == "email"
          return if DeviseTokenAuth.send_confirmation_email

          @resource.skip_confirmation!
        end

        def default_confirm_success_url
          frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:3000")
          parsed = URI.parse(frontend_url)

          unless %w[http https].include?(parsed.scheme) && parsed.host.present?
            raise ActionController::BadRequest, "FRONTEND_URL の設定が不正です"
          end

          "#{frontend_url.chomp('/')}/login"
        end
      end
    end
  end
end
