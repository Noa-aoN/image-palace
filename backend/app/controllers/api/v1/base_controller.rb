module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate_user!
      after_action :record_visit

      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      # 「その日来た人」を数えるための記録。1日1回しか書かない（User#touch_last_seen!）。
      #
      # after_action に置くのは、本来の応答を1ミリも遅らせたくないため……ではなく、
      # **失敗しても応答を壊さないため**。数えるための記録が、機能を止める理由になってはいけない。
      #
      # ここで数えるのは「来た（Active）」であって「使った（Engagement）」ではない。
      # 何かを作った・生成した・復習したは、それぞれの記録（items / image_usages /
      # credit_transactions / item_reviews）から別に数える。
      def record_visit
        return unless current_user

        current_user.touch_last_seen!
      rescue StandardError => e
        Rails.logger.warn "[record_visit] FAILED user_id=#{current_user&.id} #{e.class}: #{e.message}"
      end

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
      # 既定は危険操作の猶予（短い方）。執務室に居るかどうかの判断だけが
      # 広い窓（StrongAuthSession::ADMIN_WINDOW）を明示して呼ぶ
      def strongly_authenticated?(within: StrongAuthSession::WINDOW)
        StrongAuthSession.fresh?(user: current_user, client_id: current_client_id, within: within)
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
