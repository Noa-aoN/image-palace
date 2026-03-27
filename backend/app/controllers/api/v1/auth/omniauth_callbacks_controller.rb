# frozen_string_literal: true

module Api
  module V1
    module Auth
      class OmniauthCallbacksController < DeviseTokenAuth::OmniauthCallbacksController
        # OmniAuth は /omniauth/google_oauth2/callback で auth_hash を env にセットした後、
        # Rails が redirect_callbacks へルーティングする。
        # そのリクエスト内では env['omniauth.auth'] が取得できるため、
        # セッション経由のリダイレクトを挟まずここで直接処理する。
        def redirect_callbacks
          if request.env['omniauth.auth']
            @auth_hash = request.env['omniauth.auth']
            omniauth_success
          else
            super
          end
        end

        def omniauth_success
          @auth_hash ||= request.env['omniauth.auth']

          # ユーザーを取得または作成
          @user = User.find_for_oauth(@auth_hash)

          # devise_token_auth 標準メソッドでトークン発行
          auth_header = @user.create_new_auth_token

          # レスポンスヘッダーにトークン情報を設定
          response.headers.merge!(auth_header)

          # フロントエンド実装後はリダイレクトに切り替える:
          # frontend_url = ENV.fetch('FRONTEND_URL', 'http://localhost:3000')
          # redirect_to "#{frontend_url}/auth/callback?#{auth_header.to_query}", allow_other_host: true

          # 開発確認用: JSON レスポンス
          render json: {
            data: {
              id: @user.id,
              uid: @user.uid,
              email: @user.email,
              name: @user.name,
              provider: @user.provider
            }
          }, status: :ok
        end
      end
    end
  end
end
