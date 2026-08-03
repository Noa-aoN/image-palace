module Api
  module V1
    module Admin
      # いま入っている人の運営権限を返す。画面の出し分けに使う。
      #
      # 一般ユーザーも呼べる（403 を返さない）。「権限が無い」ことは隠す情報ではなく、
      # ここを 403 にすると画面側が毎回エラーを踏むことになるため。
      class SessionsController < Api::V1::BaseController
        def show
          render json: {
            admin: current_user.admin?,
            owner: current_user.owner?,
            role: current_user.effective_role
          }
        end
      end
    end
  end
end
