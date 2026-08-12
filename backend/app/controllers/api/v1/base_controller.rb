module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      # いま使っている端末の目印。
      #
      # devise-token-auth は端末ごとに client を配る。トークンそのものは
      # 毎リクエストで作り直されるが、client は変わらないので、
      # 「この端末」を指すのに使える
      def current_client_id
        request.headers[DeviseTokenAuth.headers_names[:client]].presence
      end

      # この端末が、直近に強い確認を通っているか。
      #
      # **どの方法で確かめたかは見ない。** Passkey でも認証アプリでも
      # 復旧コードでも、通っていれば同じ扱いにする。
      # 危険操作の側が手段を知る必要はない
      def strongly_authenticated?
        StrongAuthSession.fresh?(user: current_user, client_id: current_client_id)
      end

      # 危険な操作の前に置く。通っていなければ、何が使えるかを添えて断る
      def require_strong_auth!
        return if strongly_authenticated?

        render json: {
          error: "この操作の前に、もう一度ご本人か確かめさせてください。",
          code: "strong_auth_required",
          methods: ::Auth::StrongAuth.available_methods(current_user)
        }, status: :forbidden
      end

      def not_found
        render json: { error: "Not found" }, status: :not_found
      end

      def bad_request(e)
        render json: { error: e.message }, status: :bad_request
      end
    end
  end
end
