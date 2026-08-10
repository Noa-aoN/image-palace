module Api
  module V1
    # 実績・メダル・称号。いまある記録から数え出す（保存しない）。
    class AchievementsController < BaseController
      def show
        render json: Achievements::Calculator.call(user: current_user)
      end
    end
  end
end
