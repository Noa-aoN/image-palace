# frozen_string_literal: true

module Api
  module V1
    module Auth
      # パスワード再設定のうち、**メールのリンクを踏んだ着地**だけを差し替える。
      #
      # gem の `edit` には、そのままでは本番で通せない点が2つある。
      #
      # ## 1. リダイレクトが例外になる
      #
      # `redirect_to` の戻り先はフロント（別ホスト）なので、Rails 7 以降の
      # open redirect 対策に引っかかって `OpenRedirectError` になる。
      # 戻り先は `redirect_whitelist` で既に絞ってあるので、ここでは明示的に許す。
      #
      # ## 2. 合鍵がクエリ文字列に載る
      #
      # gem の `build_auth_url` は access-token / client / uid を `?` の側に付ける。
      # クエリは**サーバーのログ・ブラウザの履歴・Referer に残る**。
      # 実際 Rails のログには `Redirected to .../reset-password?access-token=...` と出る。
      #
      # OAuth の着地（`OmniauthCallbacksController`）は同じ理由で
      # **フラグメント（#）**を使っている。こちらも揃える。
      # フラグメントはサーバーへ送られないので、ログにも Referer にも残らない。
      class PasswordsController < DeviseTokenAuth::PasswordsController
        # `validate_redirect_url_param`（gem の before_action）が先に走り、
        # 許可リストに無い戻り先はここへ来る前に弾かれる。@redirect_url は検査済み
        def edit
          @resource = resource_class.with_reset_password_token(resource_params[:reset_password_token])
          return render_edit_error unless @resource&.reset_password_period_valid?

          token = @resource.create_token
          # 一度だけ、いまのパスワードを聞かずに変えられるようにする
          @resource.allow_password_change = true if recoverable_enabled?
          @resource.skip_confirmation! if confirmable_enabled? && !@resource.confirmed_at
          @resource.save!

          redirect_to landing_url(token).to_s, allow_other_host: true
        end

        private

        # 戻り先に合鍵を載せる。**`#` の側に置く**（`?` に置かない）
        def landing_url(token)
          uri = URI.parse(@redirect_url)
          uri.fragment = {
            "access-token" => token.token,
            "client" => token.client,
            "uid" => @resource.uid,
            "reset_password" => true
          }.to_query
          uri
        end
      end
    end
  end
end
