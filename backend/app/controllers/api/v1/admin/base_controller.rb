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
      # 段階ごとの門番。**入口は support、そこから各操作で引き上げる。**
      #
      #   support  … 見るだけ。統計・利用者・監査ログ・収支の閲覧
      #   operator … 通常運用。読みもの配信・コード発行・付与・設定変更
      #   admin    … 権限・お金・セキュリティ。プラン・収支の値・役割の変更
      #
      # 引き上げは各コントローラで書く。ここに一覧を持たせると、
      # エンドポイントを足すたびに別のファイルを触ることになり、書き忘れる。
      class BaseController < Api::V1::BaseController
        before_action :require_admin!

        private

        # 運営の入口。support 以上なら通す
        def require_admin!
          return if current_user&.admin?

          # 総当たりの手がかりを与えないよう、権限が無いことだけを返す（内容は明かさない）
          Rails.logger.warn "[Admin] FORBIDDEN user_id=#{current_user&.id} path=#{request.path}"
          render json: { error: "権限がありません" }, status: :forbidden
        end

        # その段階以上を求める。足りなければ、何が足りないかは言わずに断る
        def require_role!(role)
          return if current_user&.at_least?(role)

          Rails.logger.warn "[Admin] ROLE REQUIRED=#{role} user_id=#{current_user&.id} path=#{request.path}"
          render json: { error: ROLE_DENIED.fetch(role.to_s) }, status: :forbidden
        end

        ROLE_DENIED = {
          "operator" => "この操作は運営（operator 以上）のみ行えます",
          "admin" => "この操作は運営の管理者のみ行えます"
        }.freeze

        def require_owner!
          require_role!(:admin)
        end

        def audit!(action, target: nil, details: {})
          AdminAuditLog.record!(actor: current_user, action: action, target: target, details: details)
        end
      end
    end
  end
end
