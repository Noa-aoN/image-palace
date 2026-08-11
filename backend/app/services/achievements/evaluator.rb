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

    # 同じ数を、1回の評価のあいだに何度も数え直さない。
    #
    # 条件の種類は8つしかないのに、定義は何十個もある。素直に書くと
    # 「作ったカードの枚数」を定義の数だけ数えることになる。DB は隣の部屋に無いので
    # （nrt から Neon まで片道70ms）、数え直しがそのまま待ち時間になる。
    # 実測では評価ひと回りで 144 本・約17秒かかっていた。
    #
    # 評価のあいだに数が変わることはある（別の窓でカードを作るなど）が、
    # 次に開いたときに拾える。冪等なので取りこぼしにはならない
    def count_for(type)
      @counts ||= {}
      @counts.fetch(type.to_s) { |k| @counts[k] = Conditions.value_for(k, @user) }
    end

    # 期間で切った数も同じ。「今日ぶん」は種類と起点が同じなら同じ数
    def period_count_for(type, since)
      @period_counts ||= {}
      @period_counts.fetch([ type.to_s, since ]) { |k| @period_counts[k] = PeriodCounts.value_for(type, @user, since) }
    end

    def evaluate_achievements(result)
      definitions = AchievementDefinition.registry.select { |d| d.available?(@now) }
      states = achievement_states(definitions)

      definitions.each do |definition|
        state = states[definition.id]
        next if state.nil? || state.completed? # 一度達成したものは触らない

        value = count_for(definition.condition_type)
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

    # その人の実績の行を、まとめて読む（無ければまとめて作る）。
    #
    # 定義ごとに find_or_create_by! を呼ぶと、達成済みで何もしない実績にも
    # 1往復かかる。行は必ず作る（進み具合を持つのは行のほう）ので、
    # 「読んで、足りないぶんだけ作って、もう一度読む」の3往復で済ませる
    def achievement_states(definitions)
      existing = UserAchievement.where(user_id: @user.id, achievement_definition_id: definitions.map(&:id))
                                .index_by(&:achievement_definition_id)
      missing = definitions.reject { |d| existing.key?(d.id) }
      return existing if missing.empty?

      UserAchievement.insert_all(
        missing.map do |d|
          { user_id: @user.id, achievement_definition_id: d.id, progress: 0,
            created_at: @now, updated_at: @now }
        end,
        unique_by: %i[user_id achievement_definition_id]
      )
      UserAchievement.where(user_id: @user.id, achievement_definition_id: definitions.map(&:id))
                     .index_by(&:achievement_definition_id)
    end

    # ミッションも同じ。ただし期間ごとに行が分かれるので、鍵は定義と期間の組
    def mission_states(pairs)
      keys = pairs.map(&:first).map(&:id)
      existing = UserMission.where(user_id: @user.id, mission_definition_id: keys)
                            .index_by { |m| [ m.mission_definition_id, m.period_key ] }
      missing = pairs.reject { |d, period| existing.key?([ d.id, period ]) }
      return existing if missing.empty?

      UserMission.insert_all(
        missing.map do |d, period|
          { user_id: @user.id, mission_definition_id: d.id, period_key: period, progress: 0,
            created_at: @now, updated_at: @now }
        end,
        unique_by: %i[user_id mission_definition_id period_key]
      )
      UserMission.where(user_id: @user.id, mission_definition_id: keys)
                 .index_by { |m| [ m.mission_definition_id, m.period_key ] }
    end

    def evaluate_missions(result)
      definitions = MissionDefinition.registry.select { |d| d.available?(@now) }
      # シリーズは段の順に見る。前の段が済むまで、次の段は開かない。
      # 開いていない段の行は作らない（作ると「挑戦中」として数えられてしまう）
      definitions = definitions.sort_by { |d| [ d.mission_series_id.to_s, d.series_step, d.position ] }
      opened = completed_steps(definitions)

      # 開いている段だけ行を作る。開いていない段まで作ると「挑戦中」として数えられる。
      # ただし、この回で段が開くこともあるので、開いた先の行はその場で作る
      states = mission_states(definitions.select { |d| open?(d, opened) }.map { |d| [ d, d.period_key(@now) ] })

      definitions.each do |definition|
        next unless open?(definition, opened)

        period = definition.period_key(@now)
        state = states[[ definition.id, period ]] ||
                UserMission.find_or_create_by!(user: @user, mission_definition: definition, period_key: period)
        next if state.completed?

        value = mission_value(definition)
        completed = value >= definition.condition_target
        state.update!(progress: value, completed_at: completed ? @now : nil)
        next unless completed

        result.completed_missions << definition
        # この場で開いた段を覚える。同じ回で次の段まで進めるようにする
        # （既に条件を満たしている人を、段の数だけ待たせない）
        opened[definition.mission_series_id] = definition.series_step if definition.mission_series_id
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

    # シリーズごとに、済んでいる段のいちばん大きいもの
    def completed_steps(definitions)
      ids = definitions.filter_map(&:mission_series_id).uniq
      return {} if ids.empty?

      UserMission.where(user_id: @user.id).where.not(completed_at: nil)
                 .joins(:mission_definition)
                 .where(mission_definitions: { mission_series_id: ids })
                 .group("mission_definitions.mission_series_id")
                 .maximum("mission_definitions.series_step")
    end

    # その段は開いているか。単発のミッションは常に開いている
    def open?(definition, opened)
      return true if definition.mission_series_id.blank?

      opened[definition.mission_series_id].to_i >= definition.series_step - 1
    end

    # 今日ぶん・今週ぶんは、その期間に入ってからの数を見る。
    # 通算の数で判定すると、既に条件を満たしている人は初日に全部達成してしまう
    def mission_value(definition)
      since = definition.counted_since(@now)
      return count_for(definition.condition_type) if since.nil?

      period_count_for(definition.condition_type, since)
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
