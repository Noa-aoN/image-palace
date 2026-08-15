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
        mission_series: mission_series,
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
      starred = UserReward.where(user_id: @user.id).featured.includes(:reward_definition)
      by_kind = starred.group_by { |r| r.reward_definition.kind }
      title = by_kind["title"]&.first

      {
        title: title && reward_row(title.reward_definition),
        # 称号が無い人に「ありません」とだけ出しても、次に何をすればよいか分からない
        next_title: title ? nil : next_title,
        # 星を入れたものを種別ごとに返す。出す場所が種別で違うため
        #   称号=名乗る / 勲章=掲げる / 宝物=飾る / 表彰=プロフィール
        showcase: RewardDefinition::DISPLAY_ORDER.to_h { |kind|
          [ kind, (by_kind[kind] || []).map { |r| reward_row(r.reward_definition) } ]
        },
        limits: Showcase::LIMITS,
        featured: (by_kind["medal"] || []).map { |r| reward_row(r.reward_definition) },
        # 積み上げの数字。種別ごとの数まで出すのは、
        # 「何個持っているか」より「どれを集めているか」のほうが眺めていて楽しいため
        counts: counts_by_kind,
        rewards_earned: stat.rewards_earned,
        achievements_completed: stat.achievements_completed,
        achievements_total: AchievementDefinition.registry.count { |d| d.published? },
        streak_days: stat.streak_days,
        longest_streak: stat.longest_streak,
        active_days: stat.active_days,
        # 入居からの日数。続けている実感は、数より「どれだけ長く居るか」で出る
        days_since_joined: (Date.current - @user.created_at.to_date).to_i
      }
    end

    # 種別ごとに「持っている数 / ぜんぶの数」。分母が無いと、集め具合が分からない
    def counts_by_kind
      all = RewardDefinition.registry.select { |d| (d.published? || owned.key?(d.id)) && visible?(d, owned[d.id]) }
      RewardDefinition::DISPLAY_ORDER.to_h do |kind|
        rows = all.select { |d| d.kind == kind }
        [ kind, { owned: rows.count { |d| owned.key?(d.id) }, total: rows.size } ]
      end
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

    def mission_rows
      @mission_rows ||= begin
        now = Time.current
        definitions = MissionDefinition.registry.select { |d| d.available?(now) && d.published? }
        # 1件ずつ引くと、ミッションが増えるほど問い合わせが増える。まとめて引いて突き合わせる
        states = UserMission.where(user_id: @user.id, mission_definition_id: definitions.map(&:id))
                            .index_by { |m| [ m.mission_definition_id, m.period_key ] }

        definitions.map do |definition|
          state = states[[ definition.id, definition.period_key(now) ]]
          { key: definition.key, name: definition.name, description: definition.description,
            cadence: definition.cadence, cadence_label: definition.cadence_label,
            progress: state&.progress.to_i, target: definition.condition_target,
            completed: state&.completed? || false,
            series_id: definition.mission_series_id, series_step: definition.series_step,
            rewards: reward_previews(definition.rewards) }
        end
      end
    end

    # 単発のミッション。シリーズの段はここには出さない（series 側に1本でまとめる）
    def missions
      limit_missions(mission_rows.reject { |row| row[:series_id] }.map { |row| row.except(:series_id, :series_step) })
    end

    # シリーズ。**いま挑んでいる1段**を前に出し、道のり全体は畳んだ中に置く。
    #
    # 全段を並べると、長い道は「終わらない宿題」に見える。
    # かといって次の段だけ見せると、先があること自体が伝わらない。
    # だから「1段＋開けば全段」にする。
    def mission_series
      by_series = mission_rows.select { |row| row[:series_id] }.group_by { |row| row[:series_id] }
      return [] if by_series.empty?

      MissionSeries.registry.filter_map do |series|
        next unless series.available? && series.published?

        steps = (by_series[series.id] || []).sort_by { |row| row[:series_step] }
        next if steps.empty?

        current = steps.find { |row| !row[:completed] }
        { key: series.key, name: series.name, description: series.description,
          total_steps: steps.size,
          completed_steps: steps.count { |row| row[:completed] },
          # 済んだ道は畳んだままでも分かるようにする
          current: current&.except(:series_id),
          steps: steps.map { |row| step_row(row, current) } }
      end
    end

    # 段の状態。済み／いま／これから。
    # これからの段も名前は出す。何が待っているか分からない道は歩けない
    def step_row(row, current)
      state = if row[:completed]
                "done"
      elsif current && row[:key] == current[:key]
                "current"
      else
                "locked"
      end

      row.except(:series_id).merge(state: state)
    end

    # 種別ごとに、1つの面に出す数を決める。
    #
    # ミッションは増える。増えるたびに面が縦に伸びると、毎日見る場所が毎日重くなる。
    # 上限をここに置くのは、画面側で切ると「何件あるか」を知らずに切ることになるため。
    #
    # 期間限定・イベントは絞らない。終わってしまうものを隠すと、気づく機会がそれきりになる。
    MISSION_LIMITS = { "onboarding" => 5, "daily" => 3, "weekly" => 3 }.freeze

    # 面に並べる順。MissionDefinition::CADENCES は「取りうる値」の一覧であって、
    # 見せる順ではない（あちらは daily が先頭）。まず「はじめに」、次に今日・今週の順で出す
    MISSION_ORDER = %w[onboarding daily weekly limited event].freeze

    def limit_missions(rows)
      rows.group_by { |row| row[:cadence] }
          .sort_by { |cadence, _| MISSION_ORDER.index(cadence) || 99 }
          .flat_map do |cadence, group|
            # 達成に近い順。済んだものは下へ落とす（遠いものが上に居座ると、毎日同じ顔になる）
            sorted = group.sort_by { |row| [ row[:completed] ? 1 : 0, row[:target] - row[:progress] ] }
            limit = MISSION_LIMITS[cadence]
            limit ? sorted.first(limit) : sorted
          end
    end

    def rewards
      RewardDefinition.registry.filter_map do |definition|
        held = owned[definition.id]
        # 未公開のものは、持っていない人には見せない
        next if !definition.published? && held.nil?
        next unless visible?(definition, held)

        reward_row(definition, held)
      end
    end

    # 運営だけのものを、運営でない人の一覧に出さない。
    # **条件を満たしようがないものが並ぶ**と、埋まらない枠として残り続ける。
    # 持っている人には出す（万一配られていたら、隠すほうが不親切）
    def visible?(definition, held)
      return true unless definition.admin_only

      held.present? || @user.admin?
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
        rarity_tier: definition.rarity_tier,
        category: definition.category,
        # 未獲得のものに「どうすれば手に入るか」。無いものは手動付与（表彰など）
        condition: source&.description,
        progress: progress,
        target: source&.condition_target,
        image_url: image_url_for(definition),
        owned: held.present?,
        # いくつ持っているか。重ねられないもの（称号・勲章・表彰）は常に1
        quantity: held&.quantity || 0,
        granted_at: held&.granted_at,
        first_acquired_at: held&.first_acquired_at,
        last_acquired_at: held&.last_acquired_at,
        # 星の入り切り。種別ごとの持ち方の違いは、ここで1つに畳む
        starred: held ? Showcase.starred?(held) : false,
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
            rarity_tier: definition.rarity_tier,
            image_url: image_url_for(definition) }
        when "credits"
          { type: "credits", amount: entry["amount"].to_i }
        end
      end
    end

    # 画像はあとから差し替えられる。無い間は画面側が種類ごとの絵柄で描く
    # 獲得物の絵は**どの環境でも同じもの**（定義に付いていて、利用者ごとには作らない）。
    # 手元に CDN の設定が無くても見えるよう、鍵から引くときは既定の配信元に落とす。
    # 添付を差し替えた場合は、その環境の CDN 設定に従う
    PUBLIC_IMAGE_BASE = "https://cdn.imagepalace.app"

    # 運営画面からも同じ組み立てを使う（画面ごとに作ると食い違う）
    def self.image_url_for(definition)
      new(user: nil).send(:image_url_for, definition)
    end

    def image_url_for(definition)
      path = definition.image_path
      return nil if path.blank?

      base = ENV["CDN_BASE_URL"].presence || PUBLIC_IMAGE_BASE
      "#{base}/#{path}"
    end
  end
end
