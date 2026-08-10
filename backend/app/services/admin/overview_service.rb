# frozen_string_literal: true

module Admin
  # 運営ダッシュボードの数字をまとめて作る。
  #
  # 一覧を引いて Ruby 側で数えると、行が増えたぶんだけ重くなる。
  # 数えるものは COUNT / SUM / GROUP BY で DB に数えさせ、返すのは数字だけにする。
  class OverviewService
    # 期間の決め方は Admin::Period に置く。収支ページと同じ語彙にするため
    # （ページごとに別の選び方があると、同じ「6月」で違う範囲を見ることになる）
    DEFAULT_PERIOD = Period::ROLLING[Period::DEFAULT]

    def self.call(now: Time.current, period: Period::DEFAULT)
      new(now, period).call
    end

    def initialize(now, period = Period::DEFAULT)
      @now = now
      @period = Period.resolve(period, now: now)
      @days = @period.days
      @since = @period.from
      @until = @period.to
    end

    def call
      {
        generated_at: @now,
        period: @period.to_h.merge(options: Period.options(now: @now)),
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
        # 概要にも収支を出す。別リクエストにすると、遠い DB への往復が二重になる。
        # 期間は上の選択に合わせる。ここだけ「今月」だと、90日を見ているのに
        # 収入だけ今月ぶん、という読み違いが起きる
        finance: finance_summary,
        series: {
          days: @days,
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
        new_in_period: User.where(created_at: @since...@until).count,
        # 直近30日に1枚でもカードを作った人。「使われているか」を見るための数
        active_in_period: Item.where(created_at: @since...@until).distinct.count(:user_id),
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
        items_in_period: Item.where(created_at: @since...@until).count,
        shared_medias: shared,
        # 同じ単語を作り直さずに済んだ割合。生成した枚数のうち、絵を新たに作らずに済んだぶん
        cache_hit_rate: completed.positive? ? ((completed - shared).fdiv(completed) * 100).round(1) : 0.0,
        shared_briefs: SharedBrief.count
      }
    end

    def billing_summary
      scope = Subscription.where(status: %w[active trialing])
      active = scope.count
      # テストで作った契約を本物と混ぜない。決済側（credit_transactions.livemode）と同じ扱いで、
      # 目印を持たない古い行は「本番の決済がまだ無かった時期のもの」＝テストとみなす
      live = scope.where(livemode: true).count
      total = User.count
      consumed = CreditTransaction.where(kind: "consumption", created_at: @since...@until).sum(:delta)
      trialing = scope.where(status: "trialing").count

      {
        active_subscriptions: active,
        live_subscriptions: live,
        test_subscriptions: active - live,
        # お試し中は、まだお金が入っていない。「有料契約」と一緒に数えると入金を読み違える
        trialing_subscriptions: trialing,
        # 今期の終わりで切れるもの。落ち込みを事前に見るため
        canceling_subscriptions: scope.where(cancel_at_period_end: true).count,
        # 有料に至った割合。母数は登録した全員
        paid_rate: total.positive? ? (active.fdiv(total) * 100).round(1) : 0.0,
        by_plan: plan_breakdown(scope),
        # 消費は負の値で記録されているので、使ったぶんを正の数にして返す
        credits_consumed: (-consumed).fdiv(::Billing::POINTS_PER_CREDIT).round(2),
        # 未使用の総量は credit_liability が持つ。ここで別に数え直すと、
        # 同じ画面に同じ名前の違う数字が並ぶ（実際、期限付きグラントを取りこぼしていた）
        outstanding_credits: credit_liability[:total]
      }
    end

    # プラン別の人数と、その月にいくらになるか。
    # 人数だけでは「どのプランが売上を支えているか」が分からない
    def plan_breakdown(scope)
      # 呼び名（市民・書記官…）は画面側が tier から引く。ここは素の値を返す
      counts = scope.joins(:plan).group("plans.name", "plans.tier", "plans.price_cents").count
      counts.map { |(name, tier, price_cents), count|
        { name: name, tier: tier, count: count, mrr_jpy: price_cents.to_i * count }
      }.sort_by { |row| -row[:mrr_jpy] }
    end

    # 未使用クレジットの総量。
    #
    # 受け取ったのにまだ提供していないぶん＝これから原価がかかる約束。
    # 期限の有無で分けて見えないと、いつまでにいくら出ていくのかが読めない。
    # サービスを畳むときの返金額の目安にもなる。
    # 選んだ期間の収支。月を選んだときは、その月として（インフラ月額を1か月ぶんで）数える
    def finance_summary
      if @period.key.match?(Period::MONTH_FORMAT)
        year, month = @period.key.split("-").map(&:to_i)
        ::Admin::FinanceService.call(year: year, month: month)
      else
        ::Admin::FinanceService.new(from: @since, to: @until).call
      end
    end

    def credit_liability
      @credit_liability ||= build_credit_liability
    end

    def build_credit_liability
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

      total_points = subscription_points + old_topup_points + grants["all"].to_i

      {
        # 期限付き: 月額の当月分と、期限付きグラント（繰り越し・ボーナス）
        expiring: to_credits(subscription_points + grants["expiring"].to_i),
        # 期限なし: 期限が付く前の古い買い切りと、期限を付けずに配ったグラント。
        # いまは買い切りも6か月で失効するので、ここは増えない（古い残りが減るだけ）
        unlimited: to_credits(old_topup_points + grants["unlimited"].to_i),
        total: to_credits(total_points),
        # 未使用クレジットが**全部使われたら**、これだけ原価が出る（円）。
        # クレジットの数だけ見ても、いくら抱えているのかは分からない。
        #
        # 単価は Catalog::COST_PER_CREDIT（9円）ではなく、**いまの実費**を使う。
        # あちらは値付けを決めるための安全側の見立てで、実際に出ていく額ではない。
        # 収支ページと同じ出どころ（既定の画像モデルの単価 × 為替）にして、
        # 2つの画面が違う原価を言わないようにする
        total_cost_jpy: (to_credits(total_points) * credit_unit_cost_jpy).round,
        credit_unit_cost_jpy: credit_unit_cost_jpy.round(2),
        # 内訳（どこに溜まっているか）
        breakdown: {
          subscription: to_credits(subscription_points),
          topup: to_credits(topup_points),
          grant: to_credits(grant_points)
        },
        # 直近30日で失効したぶん（使われずに消えた量）
        expired_in_period: to_credits(-CreditTransaction.where(kind: %w[subscription_expire grant_expire])
                                                       .where(created_at: @since...@until).sum(:delta)),
        # 買い切りで**受け取った金額**のうち、まだ提供していないぶんの目安（円）。
        # total_cost_jpy（これから出ていく原価）とは別物。あちらは支出、こちらは預り。
        # 終了を告知するとき、返すべき額の目安になる
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

    # クレジット1つ（＝画像1枚）の実費（円）。
    # 既定の画像モデルの単価に為替を掛ける。収支ページの画像原価と同じ出どころ
    def credit_unit_cost_jpy
      @credit_unit_cost_jpy ||= begin
        costs = CostParameter.table
        model = AiModel.registry.find { |m| m.kind == "image" && m.default_for_kind } ||
                AiModel.registry.find { |m| m.kind == "image" }
        usd = model ? costs.image_unit_usd(model: model.model_id) : 0.0
        usd * costs.value_for("fx_usd_jpy")
      end
    end

    def to_credits(points)
      points.to_i.fdiv(::Billing::POINTS_PER_CREDIT).round(2)
    end

    def ai_summary
      rows = AiUsage.where(created_at: @since...@until).group(:kind).pluck(
        Arel.sql("kind"),
        Arel.sql("COUNT(*)"),
        Arel.sql("COALESCE(SUM(prompt_tokens + completion_tokens), 0)")
      )
      {
        calls_in_period: rows.sum { |row| row[1] },
        tokens_in_period: rows.sum { |row| row[2] },
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

    # 日ごとの件数。作られなかった日も 0 で埋めて、折れ線が途切れないようにする。
    #
    # 期間が長いときは何日かをまとめる。90日ぶんを1日1点で描くと、
    # 点が細かすぎて傾きが読めなくなる（読みたいのは日々の上下ではなく傾き）
    def daily_counts(scope)
      counts = scope.where(created_at: @since...@until)
                    .group(Arel.sql("DATE(created_at)"))
                    .count
                    .transform_keys(&:to_s)

      bucket = @period.bucket_days
      (0...@days).each_slice(bucket).map do |offsets|
        dates = offsets.map { |offset| (@since + offset.days).to_date.to_s }
        { date: dates.first, count: dates.sum { |date| counts[date].to_i } }
      end
    end

    # よく作っている人。名前は出さず、識別子と件数だけにする（一覧の目的は分布を見ること）
    def top_creators(limit: 10)
      Item.group(:user_id).order(Arel.sql("COUNT(*) DESC")).limit(limit).count
          .map { |user_id, count| { user_id: user_id, items: count } }
    end
  end
end
