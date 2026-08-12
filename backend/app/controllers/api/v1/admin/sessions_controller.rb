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

        # ここは**ログインしている全員**が通る（サイドバーの出し分けに使う）。
        # 強い確認は運営の話なので、運営でない人には調べに行かない。
        # 求めていないときも同じ。**見ない値のために問い合わせを増やすと、
        # その分だけ全員が待つ**（画面は admin が false の時点で読むのをやめる）
        def strong_auth_state
          return { required: false } unless ::Auth::StrongAuth.admin_required? && current_user.admin?

          # 一度だけ調べる。prepared? は中で available_methods を呼ぶので、
          # 両方を呼ぶと同じことを二度聞くことになる
          methods = ::Auth::StrongAuth.available_methods(current_user)

          {
            required: true,
            satisfied: strongly_authenticated?,
            prepared: methods.any?,
            methods: methods
          }
        end
      end
    end
  end
end
