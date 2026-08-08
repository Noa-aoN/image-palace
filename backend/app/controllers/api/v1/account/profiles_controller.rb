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

        # 表示名の変更。
        #
        # 外部アカウント（Google 等）の名前は登録時の初期値として入れてあるだけで、
        # 以後は本人が自由に変えられる。空にすると初期値へ戻す扱いにする
        # （別途ニックネーム欄を持つより、1つの表示名を編集できる方が迷いが少ない）。
        def update
          if current_user.update(profile_params)
            render json: profile_json(current_user)
          else
            render json: { errors: current_user.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def profile_params
          params.require(:profile).permit(:name)
        end
      end
    end
  end
end
