# frozen_string_literal: true

module Achievements
  # 実績とミッションの進み具合を数え直し、届いたものを配る。
  #
  # **冪等**。何度走らせても、達成済みのものには触らない。
  # だからページを開くたびに呼んでも、ジョブから呼んでも同じ結果になる。
  #
  # 呼ぶ場所は3つだけに絞る（ページを開いたとき・主要な操作のあと・手動付与）。
  # あちこちにフックを撒くと、どこで何が起きているのか追えなくなる。
  class Evaluator
    Result = Struct.new(:completed_achievements, :completed_missions, :granted_rewards, keyword_init: true)

    def self.call(user:, now: Time.current)
      new(user, now).call
    end

    def initialize(user, now = Time.current)
      @user = user
      @now = now
    end

    def call
      result = Result.new(completed_achievements: [], completed_missions: [], granted_rewards: [])
      evaluate_achievements(result)
      evaluate_missions(result)
      UserStat.recompute!(@user)
      result
    end

    private

    def evaluate_achievements(result)
      AchievementDefinition.registry.each do |definition|
        next unless definition.available?(@now)

        state = UserAchievement.find_or_create_by!(user: @user, achievement_definition: definition)
        next if state.completed? # 一度達成したものは触らない

        value = Conditions.value_for(definition.condition_type, @user)
        completed = value >= definition.condition_target
        state.update!(progress: value, completed_at: completed ? @now : nil)
        next unless completed

        result.completed_achievements << definition
        result.granted_rewards.concat(
          Granter.grant_rewards(
            user: @user, rewards: definition.rewards, source: "achievement",
            source_ref: definition.key, now: @now
          )
        )
        notify_achievement(definition)
      end
    rescue ActiveRecord::RecordNotUnique
      # 同時に走った別のリクエストが先に作った。次の評価で拾える
      nil
    end

    def evaluate_missions(result)
      MissionDefinition.registry.each do |definition|
        next unless definition.available?(@now)

        period = definition.period_key(@now)
        state = UserMission.find_or_create_by!(
          user: @user, mission_definition: definition, period_key: period
        )
        next if state.completed?

        value = mission_value(definition)
        completed = value >= definition.condition_target
        state.update!(progress: value, completed_at: completed ? @now : nil)
        next unless completed

        result.completed_missions << definition
        result.granted_rewards.concat(
          Granter.grant_rewards(
            user: @user, rewards: definition.rewards, source: "mission",
            source_ref: definition.key, now: @now
          )
        )
        notify_mission(definition)
      end
    rescue ActiveRecord::RecordNotUnique
      nil
    end

    # 今日ぶん・今週ぶんは、その期間に入ってからの数を見る。
    # 通算の数で判定すると、既に条件を満たしている人は初日に全部達成してしまう
    def mission_value(definition)
      since = definition.counted_since(@now)
      return Conditions.value_for(definition.condition_type, @user) if since.nil?

      PeriodCounts.value_for(definition.condition_type, @user, since)
    end

    def notify_achievement(definition)
      Notifications::CreateService.call(
        user: @user,
        kind: "achievement_completed",
        title: definition.notify_title.presence || "実績を達成しました",
        body: definition.notify_body.presence || "「#{definition.name}」",
        url: "/achievements?highlight=#{definition.key}",
        payload: { "achievement_key" => definition.key }
      )
    rescue StandardError => e
      Rails.logger.warn "[Achievements] NOTIFY FAILED achievement=#{definition.key} #{e.class}: #{e.message}"
    end

    def notify_mission(definition)
      Notifications::CreateService.call(
        user: @user,
        kind: "mission_completed",
        title: definition.notify_title.presence || "ミッション達成",
        body: definition.notify_body.presence || "「#{definition.name}」を達成しました。",
        url: "/achievements",
        payload: { "mission_key" => definition.key }
      )
    rescue StandardError => e
      Rails.logger.warn "[Achievements] NOTIFY FAILED mission=#{definition.key} #{e.class}: #{e.message}"
    end
  end
end
