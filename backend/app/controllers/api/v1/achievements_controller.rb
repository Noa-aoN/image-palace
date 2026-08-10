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

      # 称号を1つ装備する。key を空で送ると外す
      def equip
        reward = find_owned(params[:key])
        return render_not_owned if reward.nil? && params[:key].present?

        UserReward.where(user_id: current_user.id, equipped: true).update_all(equipped: false)
        reward&.update!(equipped: true)

        render json: Achievements::Presenter.call(user: current_user)
      end

      # 代表として掲げる勲章を入れ替える。上限を超えたら古いものから外す
      def feature
        reward = find_owned(params[:key])
        return render_not_owned if reward.nil?

        if reward.featured_at.present?
          reward.update!(featured_at: nil)
        else
          reward.update!(featured_at: Time.current)
          trim_featured!
        end

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

      # 掲げられる数には上限がある。並べすぎると1つ1つが目に入らない
      def trim_featured!
        extra = UserReward.where(user_id: current_user.id)
                          .where.not(featured_at: nil)
                          .order(featured_at: :desc)
                          .offset(Achievements::Presenter::MAX_FEATURED)
        UserReward.where(id: extra.map(&:id)).update_all(featured_at: nil) if extra.any?
      end
    end
  end
end
