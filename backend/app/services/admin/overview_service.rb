# frozen_string_literal: true

module Admin
  # 運営ダッシュボードの数字をまとめて作る。
  #
  # 一覧を引いて Ruby 側で数えると、行が増えたぶんだけ重くなる。
  # 数えるものは COUNT / SUM / GROUP BY で DB に数えさせ、返すのは数字だけにする。
  class OverviewService
    # 折れ線に出す日数
    SERIES_DAYS = 30

    def self.call(now: Time.current)
      new(now).call
    end

    def initialize(now)
      @now = now
      @since = now - SERIES_DAYS.days
    end

    def call
      {
        generated_at: @now,
        users: users_summary,
        content: content_summary,
        generation: generation_summary,
        billing: billing_summary,
        credit_liability: credit_liability,
        ai: ai_summary,
        limits: limits_summary,
        provider_status: provider_status,
        # ジョブが積まれたまま動いていないと、カードが「生成待ち」で止まり続ける
        queue: queue_status,
        # 概要にも今月の収支を出す。別リクエストにすると、遠い DB への往復が二重になる
        finance: ::Admin::FinanceService.call(year: @now.year, month: @now.month),
        series: {
          days: SERIES_DAYS,
          new_users: daily_counts(User.all),
          new_items: daily_counts(Item.all)
        },
        top_creators: top_creators
      }
    end

    private

    def users_summary
      {
        total: User.count,
        confirmed: User.where.not(confirmed_at: nil).count,
        new_last_7d: User.where(created_at: (@now - 7.days)..).count,
        new_last_30d: User.where(created_at: @since..).count,
        # 直近30日に1枚でもカードを作った人。「使われているか」を見るための数
        active_last_30d: Item.where(created_at: @since..).distinct.count(:user_id),
        # ENV 由来の owner も数える。role だけを見ると「運営メンバー 0」と出てしまう
        admins: User.effective_admins.count
      }
    end

    def content_summary
      row = Item.connection.select_one(<<~SQL.squish)
        SELECT
          (SELECT COUNT(*) FROM items) AS items,
          (SELECT COUNT(*) FROM views) AS views,
          (SELECT COUNT(*) FROM spaces) AS spaces,
          (SELECT COUNT(*) FROM boxes) AS boxes,
          (SELECT COUNT(*) FROM wordlists) AS wordlists,
          (SELECT COUNT(*) FROM tags) AS tags
      SQL

      row.transform_values(&:to_i).symbolize_keys
    end

    def generation_summary
      by_status = Item.group(:generation_status).count
      shared = SharedMedia.count
      completed = by_status["completed"].to_i
      {
        by_status: Item::GENERATION_STATUSES.index_with { |status| by_status[status].to_i },
        items_last_30d: Item.where(created_at: @since..).count,
        shared_medias: shared,
        # 同じ単語を作り直さずに済んだ割合。生成した枚数のうち、絵を新たに作らずに済んだぶん
        cache_hit_rate: completed.positive? ? ((completed - shared).fdiv(completed) * 100).round(1) : 0.0,
        shared_briefs: SharedBrief.count
      }
    end

    def billing_summary
      active = Subscription.where(status: %w[active trialing]).count
      total = User.count
      consumed = CreditTransaction.where(kind: "consumption", created_at: @since..).sum(:delta)
      {
        active_subscriptions: active,
        # 有料に至った割合。母数は登録した全員
        paid_rate: total.positive? ? (active.fdiv(total) * 100).round(1) : 0.0,
        by_plan: Subscription.where(status: %w[active trialing]).joins(:plan).group("plans.name").count,
        # 消費は負の値で記録されているので、使ったぶんを正の数にして返す
        credits_consumed_last_30d: (-consumed).fdiv(::Billing::POINTS_PER_CREDIT).round(2),
        outstanding_credits: (User.sum(:subscription_credits) + User.sum(:topup_credits))
                             .fdiv(::Billing::POINTS_PER_CREDIT).round(2)
      }
    end

    # 未使用クレジットの総量。
    #
    # 受け取ったのにまだ提供していないぶん＝これから原価がかかる約束。
    # 期限の有無で分けて見えないと、いつまでにいくら出ていくのかが読めない。
    # サービスを畳むときの返金額の目安にもなる。
    def credit_liability
      grants = grant_totals
      users = user_credit_totals

      subscription_points = users["subscription"].to_i
      old_topup_points = users["topup"].to_i
      # 買い切りは2か所に散っている。期限が付く前の古い残り（users.topup_credits）と、
      # いまの積み方（credit_grants の kind: topup、6か月で失効）。
      # 片方だけ数えると、受け取ったお金のぶんが「付与」に化ける。
      topup_points = old_topup_points + grants["topup"].to_i
      # 付与はこちらが配ったぶん。買い切りを除く
      grant_points = grants["non_topup"].to_i

      {
        # 期限付き: 月額の当月分と、期限付きグラント（繰り越し・ボーナス）
        expiring: to_credits(subscription_points + grants["expiring"].to_i),
        # 期限なし: 期限が付く前の古い買い切りと、期限を付けずに配ったグラント。
        # いまは買い切りも6か月で失効するので、ここは増えない（古い残りが減るだけ）
        unlimited: to_credits(old_topup_points + grants["unlimited"].to_i),
        total: to_credits(subscription_points + old_topup_points + grants["all"].to_i),
        # 内訳（どこに溜まっているか）
        breakdown: {
          subscription: to_credits(subscription_points),
          topup: to_credits(topup_points),
          grant: to_credits(grant_points)
        },
        # 直近30日で失効したぶん（使われずに消えた量）
        expired_last_30d: to_credits(-CreditTransaction.where(kind: %w[subscription_expire grant_expire])
                                                       .where(created_at: @since..).sum(:delta)),
        # 買い切りで受け取った金額のうち、まだ提供していないぶんの目安（円）。
        # 終了を告知するとき、どれだけの未提供が残っているかの目安になる
        unused_topup_value: unused_topup_value(old_topup_points, grants["topup_all"].to_i),
        # 直近で期限が来るもの
        next_expiry_at: grants["next_expiry_at"]
      }
    end

    # クレジットの残量。条件ごとに SUM を並べると往復の数だけ待つので、1回にまとめる
    def grant_totals
      CreditGrant.connection.select_one(<<~SQL.squish)
        SELECT
          COALESCE(SUM(remaining_points) FILTER (WHERE remaining_points > 0), 0) AS all,
          COALESCE(SUM(remaining_points) FILTER (WHERE remaining_points > 0 AND expires_at IS NOT NULL), 0) AS expiring,
          COALESCE(SUM(remaining_points) FILTER (WHERE remaining_points > 0 AND expires_at IS NULL), 0) AS unlimited,
          COALESCE(SUM(remaining_points) FILTER (WHERE remaining_points > 0 AND kind = 'topup'), 0) AS topup,
          COALESCE(SUM(remaining_points) FILTER (WHERE remaining_points > 0 AND kind <> 'topup'), 0) AS non_topup,
          COALESCE(SUM(remaining_points) FILTER (WHERE kind = 'topup'), 0) AS topup_all,
          MIN(expires_at) FILTER (WHERE remaining_points > 0 AND expires_at IS NOT NULL) AS next_expiry_at
        FROM credit_grants
      SQL
    end

    def user_credit_totals
      User.connection.select_one(<<~SQL.squish)
        SELECT
          COALESCE(SUM(subscription_credits), 0) AS subscription,
          COALESCE(SUM(topup_credits), 0) AS topup
        FROM users
      SQL
    end

    # 買い切りの平均単価 × 未使用の買い切りクレジット。
    # 「受け取ったのにまだ提供していない額」の目安。終了を計画するときの判断材料になる。
    def unused_topup_value(old_topup_points, topup_grant_points)
      row = CreditTransaction.connection.select_one(
        CreditTransaction.sanitize_sql_array([
          <<~SQL.squish,
            SELECT COALESCE(SUM(amount_cents), 0) AS paid, COALESCE(SUM(delta), 0) AS points
            FROM credit_transactions
            WHERE kind = :kind AND amount_cents IS NOT NULL
          SQL
          { kind: "topup_purchase" }
        ])
      )
      points = row["points"].to_i
      return 0 if points.zero?

      # 期限付きで積むようになったので、買い切りのグラント残量も数える
      unused = old_topup_points + topup_grant_points
      (unused * row["paid"].to_i.fdiv(points)).round
    end

    def to_credits(points)
      points.to_i.fdiv(::Billing::POINTS_PER_CREDIT).round(2)
    end

    def ai_summary
      rows = AiUsage.since(@since).group(:kind).pluck(
        Arel.sql("kind"),
        Arel.sql("COUNT(*)"),
        Arel.sql("COALESCE(SUM(prompt_tokens + completion_tokens), 0)")
      )
      {
        calls_last_30d: rows.sum { |row| row[1] },
        tokens_last_30d: rows.sum { |row| row[2] },
        by_kind: rows.map { |kind, count, tokens|
          { kind: kind, label: AiUsage.label_for(kind), count: count, tokens: tokens }
        }.sort_by { |row| -row[:count] }
      }
    end

    # いま効いている上限。
    #
    # 「月に何枚まで作れるのか」は複数の定数と ENV に散っていて、コードを読まないと分からない。
    # 値を持っている場所（定数名・ENV 名）ごと出して、画面と実態がずれないようにする。
    #
    # 画像生成の枚数はクレジット残高で決まる（1クレジット = 1枚）。
    # 固定の月間上限は無く、付与量が実質の上限になる。
    def limits_summary
      {
        image: {
          gate: "credits",
          trial_credits: ::Billing::Catalog::TRIAL_CREDITS,
          monthly_free_credits: ::Billing::Catalog::MONTHLY_FREE_CREDITS,
          credit_lifetime_months: (::Billing::Catalog::CREDIT_LIFETIME / 1.month).to_i,
          plans: ::Billing::Catalog::SUBSCRIPTIONS.map do |plan|
            { name: plan[:name], price: plan[:price], monthly_credits: plan[:credits] }
          end
        },
        ai: {
          daily_call_cap: ::Ai::UsageLimit.daily_call_cap,
          daily_call_cap_env: "AI_DAILY_CALL_CAP",
          cost_points: ai_cost_points
        }
      }
    end

    # 文章生成の1回あたりのコスト。ENV で上書きされているものは印を付ける
    def ai_cost_points
      ::Ai::UsageLimit::DEFAULT_COST_POINTS.keys.map do |kind|
        env_name = "AI_COST_#{kind.upcase}"
        {
          kind: kind,
          label: AiUsage.label_for(kind),
          points: ::Ai::UsageLimit.cost_points(kind),
          env: env_name,
          overridden: ENV[env_name].present?
        }
      end
    end

    def queue_status
      status = ::Jobs::QueueWatchdog.status(now: @now)

      {
        ready: status.ready,
        claimed: status.claimed,
        workers: status.workers,
        last_heartbeat_at: status.last_heartbeat_at,
        stalled: status.stalled
      }
    end

    # 供給側（OpenAI 等）が止まっていないか。
    # ここが分からないと、生成の失敗が自前の不具合なのか外の都合なのか切り分けられない。
    def provider_status
      incident = ProviderIncident.latest_first.first
      return { ongoing: false, last_incident: nil } if incident.nil?

      {
        ongoing: incident.ongoing?(now: @now),
        last_incident: {
          provider: incident.provider,
          kind: incident.kind,
          code: incident.code,
          occurrences: incident.occurrences,
          first_occurred_at: incident.first_occurred_at,
          last_occurred_at: incident.last_occurred_at
        }
      }
    end

    # 日ごとの件数。作られなかった日も 0 で埋めて、折れ線が途切れないようにする
    def daily_counts(scope)
      counts = scope.where(created_at: @since..)
                    .group(Arel.sql("DATE(created_at)"))
                    .count
                    .transform_keys(&:to_s)

      (0...SERIES_DAYS).map do |offset|
        date = (@since + offset.days).to_date.to_s
        { date: date, count: counts[date].to_i }
      end
    end

    # よく作っている人。名前は出さず、識別子と件数だけにする（一覧の目的は分布を見ること）
    def top_creators(limit: 10)
      Item.group(:user_id).order(Arel.sql("COUNT(*) DESC")).limit(limit).count
          .map { |user_id, count| { user_id: user_id, items: count } }
    end
  end
end
