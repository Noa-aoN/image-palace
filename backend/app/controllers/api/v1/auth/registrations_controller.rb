# frozen_string_literal: true

module Api
  module V1
    module Auth
      class RegistrationsController < DeviseTokenAuth::RegistrationsController
        before_action :set_default_confirm_success_url, only: :create

        # メールアドレス変更は現状サポートしない（正式なアカウント管理画面は #80 で別途設計）。
        # devise-token-auth の update はメール変更を許容し、Confirmable のメール変更レース脆弱性
        # (GHSA-57hq-95w6-v4fc) の攻撃面になり得るため、この経路でのメール変更を明示的に塞ぐ。
        def update
          if email_change_requested?
            return render json: {
              status: "error",
              errors: [ "メールアドレスの変更は現在ご利用いただけません。" ]
            }, status: :unprocessable_entity
          end

          super
        end

        private

        # 認証済みユーザー（@resource は set_user_by_token が設定）と異なるメールが渡されたか
        def email_change_requested?
          return false if @resource.blank?

          new_email = params[:email].presence
          new_email.present? && new_email != @resource.email
        end

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
