module Api
  module V1
    module Account
      # 現在ユーザーのプロフィール（表示名・メール・アバター URL・生成ステータス）を返す。
      # アバター生成のポーリング先としても使う。
      class ProfilesController < BaseController
        include AvatarSerialization

        def show
          render json: profile_json(current_user)
        end
      end
    end
  end
end
