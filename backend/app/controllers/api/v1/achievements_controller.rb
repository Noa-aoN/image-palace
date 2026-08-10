module Api
  module V1
    # アチーブメント（栄誉の間）。
    #
    # 開いたときに数え直す。数える処理は軽く、ここで走らせておけば
    # 「操作したのに実績が付かない」が起きにくい。
    class AchievementsController < BaseController
      def show
        Achievements::Evaluator.call(user: current_user)
        render json: Achievements::Presenter.call(user: current_user)
      end

      # 装備中の称号と代表勲章だけ。エントランスの「宮殿の主人」から呼ぶ。
      # 評価は走らせない（関係のない画面に数え直しを抱えさせない）
      def summary
        render json: Achievements::Presenter.summary_only(user: current_user)
      end

      # 星の入り切り。**種別ごとの違いはサーバー側で吸収する**。
      #
      # 画面から見れば操作は1つ（星を押す）で、称号なら名乗る・勲章なら掲げる・
      # 褒賞なら飾る、と結果が変わる。画面に分岐を持たせると、種別が増えるたびに
      # 押す場所が増えていく。
      def toggle
        reward = find_owned(params[:key])
        return render_not_owned if reward.nil?

        Achievements::Showcase.toggle!(user: current_user, user_reward: reward)
        render json: Achievements::Presenter.call(user: current_user)
      end

      private

      def find_owned(key)
        return nil if key.blank?

        UserReward.joins(:reward_definition)
                  .find_by(user_id: current_user.id, reward_definitions: { key: key })
      end

      def render_not_owned
        render json: { error: "まだ獲得していません" }, status: :unprocessable_entity
      end
    end
  end
end
