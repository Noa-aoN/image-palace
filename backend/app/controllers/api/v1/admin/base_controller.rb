module Api
  module V1
    module Admin
      # 運営用エンドポイントの土台。
      #
      # 権限の判定は必ずここ（サーバー側）で行う。画面側の出し分けは見た目の話であって、
      # 守りではない。役割は毎リクエスト DB から読み直す（トークンに焼き込まない）ので、
      # 権限を外した瞬間から入れなくなる。
      #
      # 管理操作は監査ログに残す。誰がいつ何をしたか辿れないと、事故のときに何も分からない。
      class BaseController < Api::V1::BaseController
        before_action :require_admin!

        private

        def require_admin!
          return if current_user&.admin?

          # 総当たりの手がかりを与えないよう、権限が無いことだけを返す（内容は明かさない）
          Rails.logger.warn "[Admin] FORBIDDEN user_id=#{current_user&.id} path=#{request.path}"
          render json: { error: "権限がありません" }, status: :forbidden
        end

        def require_owner!
          return if current_user&.owner?

          Rails.logger.warn "[Admin] OWNER REQUIRED user_id=#{current_user&.id} path=#{request.path}"
          render json: { error: "この操作は運営の管理者のみ行えます" }, status: :forbidden
        end

        def audit!(action, target: nil, details: {})
          AdminAuditLog.record!(actor: current_user, action: action, target: target, details: details)
        end
      end
    end
  end
end
