# frozen_string_literal: true

module Achievements
  # 星を入れたものを、種別に応じた場所へ出す。
  #
  # 画面から見れば操作は1つ（星を押す）。称号なら名乗る、勲章なら掲げる、
  # 宝物なら飾る、表彰ならプロフィールに出す、と結果だけが変わる。
  # 種別ごとにボタンを分けると、札の上が操作だらけになり、絵より目立ってしまう。
  #
  # 数の上限も種別ごと。並べすぎると1つ1つが目に入らない。
  # 上限に達したら、いちばん古いものを外して入れ替える。
  # 「上限です」と拒むより、押した結果が出るほうが分かりやすい。
  module Showcase
    module_function

    LIMITS = { "title" => 1, "medal" => 3, "treasure" => 6, "honor" => 3 }.freeze

    def limit_for(kind)
      LIMITS.fetch(kind, 3)
    end

    def toggle!(user:, user_reward:)
      kind = user_reward.reward_definition.kind

      if starred?(user_reward)
        unstar!(user_reward)
      else
        star!(user_reward)
        trim!(user, kind)
      end
    end

    # 星が入っているか。持ち方は種別で違うが、外から見れば1つ
    def starred?(user_reward)
      case user_reward.reward_definition.kind
      when "title" then user_reward.equipped?
      when "treasure" then user_reward.room_placed?
      else user_reward.featured_at.present?
      end
    end

    def star!(user_reward)
      case user_reward.reward_definition.kind
      when "title" then user_reward.update!(equipped: true, featured_at: Time.current)
      when "treasure" then user_reward.update!(room_placed: true, featured_at: Time.current)
      else user_reward.update!(featured_at: Time.current)
      end
    end

    def unstar!(user_reward)
      user_reward.update!(equipped: false, room_placed: false, featured_at: nil)
    end

    # その種別で、いま星が入っている数。
    #
    # 判定の条件は star! / starred? と揃えること。ここだけ別の書き方をすると、
    # 画面では星が付いているのに実績が進まない、という食い違いになる。
    # どの種別も featured_at は必ず入るので、それを共通の目印にする
    # （称号の equipped・宝物の room_placed は、出す場所を決めるための別の印）。
    def showcased_count(user, kind)
      UserReward.held.joins(:reward_definition)
                .where(user_id: user.id, reward_definitions: { kind: kind })
                .where.not(featured_at: nil)
                .count
    end

    # その種別で上限を超えたぶんを、古いものから外す
    def trim!(user, kind)
      starred = UserReward.held.joins(:reward_definition)
                          .where(user_id: user.id, reward_definitions: { kind: kind })
                          .where.not(featured_at: nil)
                          .order(featured_at: :desc)
                          .offset(limit_for(kind))
      return if starred.empty?

      UserReward.where(id: starred.map(&:id)).update_all(equipped: false, room_placed: false, featured_at: nil)
    end
  end
end
