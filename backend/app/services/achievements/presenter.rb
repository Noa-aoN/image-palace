# frozen_string_literal: true

module Achievements
  # 画面に出す形に整える。
  #
  # 未獲得のものも**名前と条件を出す**。何を目指せるか分からないと目標にならない。
  # ただし未公開のものは存在ごと出さない（不意打ち用に取っておけるように）。
  class Presenter
    # 掲げられる勲章の数。並べすぎると1つ1つが目に入らない
    MAX_FEATURED = 3
    # 「もうすぐ獲得」に出す数と、出す下限（半分まで来ていれば「もうすぐ」）
    UPCOMING_LIMIT = 5
    UPCOMING_MIN_RATIO = 0.5

    def self.call(user:)
      new(user).call
    end

    # 装備中の称号と代表勲章だけ。エントランスなど、栄誉の間の外から呼ぶ用。
    # ここで評価まで走らせると、関係のない画面が実績の数え直しを抱えることになる
    def self.summary_only(user:)
      new(user).summary
    end

    def initialize(user)
      @user = user
    end

    def call
      {
        summary: summary,
        upcoming: upcoming,
        missions: missions,
        rewards: rewards,
        achievements: achievements,
        stats: stat.to_rows,
        categories: AchievementDefinition::CATEGORY_ORDER,
        max_featured: MAX_FEATURED
      }
    end

    private

    def stat
      @stat ||= UserStat.find_by(user_id: @user.id) || UserStat.recompute!(@user)
    end

    def owned
      @owned ||= UserReward.where(user_id: @user.id).index_by(&:reward_definition_id)
    end

    def states
      @states ||= UserAchievement.where(user_id: @user.id).index_by(&:achievement_definition_id)
    end

    public def summary
      equipped = UserReward.joins(:reward_definition).find_by(user_id: @user.id, equipped: true)
      featured = UserReward.where(user_id: @user.id).featured.includes(:reward_definition)

      {
        title: equipped && reward_row(equipped.reward_definition),
        # 称号が無い人に「ありません」とだけ出しても、次に何をすればよいか分からない
        next_title: equipped ? nil : next_title,
        featured: featured.map { |r| reward_row(r.reward_definition) },
        rewards_earned: stat.rewards_earned,
        achievements_completed: stat.achievements_completed,
        streak_days: stat.streak_days
      }
    end

    # まだ持っていない称号のうち、いちばん近いもの。
    # 「称号はまだありません」で終わらせず、次の一歩を出す
    def next_title
      candidates = AchievementDefinition.registry.filter_map do |definition|
        next unless definition.available? && definition.published?

        title_key = Array(definition.rewards).find { |r|
          r["type"] == "reward" && RewardDefinition.find_by(key: r["key"])&.kind == "title"
        }&.dig("key")
        next if title_key.nil?

        title = RewardDefinition.find_by(key: title_key)
        next if owned.key?(title.id)

        progress = states[definition.id]&.progress.to_i
        { name: title.name, image_url: image_url_for(title), condition: definition.description,
          progress: progress, target: definition.condition_target,
          remaining: [ definition.condition_target - progress, 0 ].max }
      end

      candidates.min_by { |row| row[:remaining] }
    end

    # あと少しで届くもの。残りが少ない順に並べる
    def upcoming
      AchievementDefinition.registry.filter_map { |definition|
        next unless definition.available? && definition.published?

        state = states[definition.id]
        next if state&.completed?

        progress = state&.progress.to_i
        target = definition.condition_target
        next if target.zero? || progress.fdiv(target) < UPCOMING_MIN_RATIO

        { key: definition.key, name: definition.name, description: definition.description,
          progress: progress, target: target, remaining: target - progress,
          rewards: reward_previews(definition.rewards) }
      }.sort_by { |row| row[:remaining] }.first(UPCOMING_LIMIT)
    end

    def missions
      now = Time.current
      MissionDefinition.registry.filter_map do |definition|
        next unless definition.available?(now) && definition.published?

        state = UserMission.find_by(
          user_id: @user.id, mission_definition_id: definition.id, period_key: definition.period_key(now)
        )
        { key: definition.key, name: definition.name, description: definition.description,
          cadence: definition.cadence, cadence_label: definition.cadence_label,
          progress: state&.progress.to_i, target: definition.condition_target,
          completed: state&.completed? || false,
          rewards: reward_previews(definition.rewards) }
      end
    end

    def rewards
      RewardDefinition.registry.filter_map do |definition|
        held = owned[definition.id]
        # 未公開のものは、持っていない人には見せない
        next if !definition.published? && held.nil?

        reward_row(definition, held)
      end
    end

    def achievements
      AchievementDefinition.registry.filter_map do |definition|
        state = states[definition.id]
        next if !definition.published? && state&.completed?.blank?

        { key: definition.key, name: definition.name, description: definition.description,
          category: definition.category, condition_target: definition.condition_target,
          progress: state&.progress.to_i, completed_at: state&.completed_at,
          rewards: reward_previews(definition.rewards) }
      end
    end

    # その獲得物を配る実績。未獲得のものに「どうすれば手に入るか」を出すために引く。
    # 実績の数は多くないので、1回だけ組み立てて使い回す
    def source_for(reward_key)
      @sources ||= AchievementDefinition.registry.each_with_object({}) do |definition, acc|
        Array(definition.rewards).each do |entry|
          next unless entry["type"] == "reward"

          acc[entry["key"]] ||= definition
        end
      end
      @sources[reward_key]
    end

    def reward_row(definition, held = owned[definition.id])
      source = held ? nil : source_for(definition.key)
      progress = source && states[source.id]&.progress.to_i

      {
        key: definition.key,
        kind: definition.kind,
        kind_label: definition.kind_label,
        name: definition.name,
        description: definition.description,
        rarity_level: definition.rarity_level,
        rarity_name: definition.rarity_name,
        rarity_tier: definition.rarity_tier,
        category: definition.category,
        # 未獲得のものに「どうすれば手に入るか」。無いものは手動付与（表彰など）
        condition: source&.description,
        progress: progress,
        target: source&.condition_target,
        image_url: image_url_for(definition),
        owned: held.present?,
        granted_at: held&.granted_at,
        equipped: held&.equipped || false,
        featured: held&.featured_at.present?,
        equippable: definition.equippable,
        featurable: definition.featurable,
        room_displayable: definition.room_displayable
      }
    end

    # 報酬の下見。何が貰えるかが分からないと「欲しい」と思えない
    def reward_previews(rewards)
      Array(rewards).filter_map do |entry|
        case entry["type"]
        when "reward"
          definition = RewardDefinition.find_by(key: entry["key"])
          next if definition.nil?

          { type: "reward", key: definition.key, name: definition.name,
            kind: definition.kind, kind_label: definition.kind_label,
            rarity_tier: definition.rarity_tier, rarity_name: definition.rarity_name,
            image_url: image_url_for(definition) }
        when "credits"
          { type: "credits", amount: entry["amount"].to_i }
        end
      end
    end

    # 画像はあとから差し替えられる。無い間は画面側が種類ごとの絵柄で描く
    def image_url_for(definition)
      return nil unless definition.image.attached?

      cdn_base = ENV["CDN_BASE_URL"]
      return nil if cdn_base.blank?

      "#{cdn_base}/#{definition.image.blob.key}"
    end
  end
end
