module Api
  module V1
    module Admin
      # いま入っている人の運営権限を返す。画面の出し分けに使う。
      #
      # 一般ユーザーも呼べる（403 を返さない）。「権限が無い」ことは隠す情報ではなく、
      # ここを 403 にすると画面側が毎回エラーを踏むことになるため。
      #
      # ここだけは強い確認を求めない（Admin::BaseController を継がない）。
      # **入口の案内板まで閉めてしまうと、何をすればよいか分からなくなる。**
      # 返すのは「求められているか・通っているか・手立てがあるか」だけで、
      # 中身は何も開かない。
      class SessionsController < Api::V1::BaseController
        def show
          render json: {
            admin: current_user.admin?,
            owner: current_user.owner?,
            role: current_user.effective_role,
            strong_auth: strong_auth_state
          }
        end

        private

        def strong_auth_state
          {
            required: ::Auth::StrongAuth.admin_required?,
            satisfied: strongly_authenticated?,
            prepared: ::Auth::StrongAuth.prepared?(current_user),
            methods: ::Auth::StrongAuth.available_methods(current_user)
          }
        end
      end
    end
  end
end
