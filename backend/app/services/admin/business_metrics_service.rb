# frozen_string_literal: true

module Admin
  # 経営の数字をまとめて作る。
  #
  # 運営ダッシュボード（OverviewService）が「いま何が動いているか」を見るのに対して、
  # ここは「商売として伸びているか」を見る。期間の語彙は Admin::Period に揃える。
  #
  # ## 決めごと
  #
  # 1. **数字を作らない。** 出せないものは nil を返し、画面は「未計測」と出す。
  #    母数が小さくて意味が薄いものは `reference: true` を添えて参考値と分かるようにする。
  # 2. **Active と Engagement を分ける。**
  #    - Active（来た）      … `users.last_seen_at`
  #    - Engagement（使った）… カード作成 / 画像生成 / 復習 / クレジット消費の実行動
  #    「見に来ただけ」と「手を動かした」は別のことなので、混ぜない。
  # 3. **遡らない。** `last_seen_at` は計測を始めた日より前を持たない。
  #    その前の期間を選んだときは、Active を「未計測」として返す（0 とは書かない）。
  # 4. 数えるものは COUNT / SUM / GROUP BY で DB に数えさせる。一覧は引かない。
  class BusinessMetricsService
    # DAU / WAU / MAU の窓（日）。MAU を30日にしているのは、
    # 無料枠の周期（登録日アニバーサリー月次）と読み比べられるようにするため。
    ACTIVE_WINDOWS = { dau: 1, wau: 7, mau: 30 }.freeze

    def self.call(now: Time.current, period: Period::DEFAULT)
      new(now, period).call
    end

    def initialize(now, period = Period::DEFAULT)
      @now = now
      @period = Period.resolve(period, now: now)
      @from = @period.from
      @to = @period.to
      # 前期間＝同じ長さだけ手前。「前期間比」はこれと比べる
      @previous_from = @from - @period.days.days
      @previous_range = @previous_from...@from
    end

    def call
      {
        generated_at: @now,
        period: @period.to_h.merge(options: Period.options(now: @now)),
        measurement: measurement_note,
        active: active_users,
        engagement: engagement,
        users: users_summary,
        revenue: revenue_summary,
        retention: retention_summary,
        unit_economics: unit_economics
      }
    end

    private

    # 何をいつから測れているか。画面の但し書きに使う。
    #
    # last_seen_at は後から足した列で、入れる前の来訪は残っていない。
    # 「いつからの数字か」を出さないと、少ない DAU を実態と読み違える。
    def measurement_note
      started_at = User.minimum(:last_seen_at)

      {
        last_seen_since: started_at,
        # 選んだ期間の始まりより後に計測を始めていれば、その期間は途中からしか無い
        last_seen_partial: started_at.present? && @from.present? && started_at > @from,
        note: "last_seen_at は計測開始日より前を持たない（遡って埋めていない）"
      }
    end

    # 来た人。**いまを起点にした窓**で数える。
    #
    # 前期間比は出せない。持っているのは利用者ごとの「最後に来た日」1点だけで、
    # 昨日や先週その人が来ていたかは、あとから復元できないため。
    # 推移が要るようになったら、日次の集計行を別に持つ（Phase 2）。
    def active_users
      measured = User.where.not(last_seen_at: nil).exists?

      counts = ACTIVE_WINDOWS.transform_values do |days|
        next nil unless measured

        User.where(last_seen_at: (@now - days.days)..@now).count
      end

      counts.merge(
        measured: measured,
        # 粘着度。毎日来ている人の割合を見る（DAU/MAU）
        stickiness: ratio(counts[:dau], counts[:mau]),
        comparable: false
      )
    end

    # 使った人。実際の行動から数える。行動ごとに別の表に残っているので、それぞれ数える。
    def engagement
      current = engagement_counts(@period.range)
      previous = engagement_counts(@previous_range)

      {
        current: current,
        previous: previous,
        # 手を動かした人（どれか1つでもやった人）あたりの行動数。割合ではなく回数
        actions_per_acting_user: per_capita(current[:actions], current[:acting_users])
      }
    end

    def engagement_counts(range)
      created = Item.where(created_at: range)
      generated = ImageUsage.where(created_at: range)
      reviewed = ItemReview.where(reviewed_at: range)
      consumed = CreditTransaction.where(kind: "consumption", created_at: range)

      acting_users = [
        created.distinct.pluck(:user_id),
        generated.where.not(user_id: nil).distinct.pluck(:user_id),
        reviewed.distinct.pluck(:user_id),
        consumed.distinct.pluck(:user_id)
      ].flatten.uniq.size

      {
        cards_created: created.count,
        images_generated: generated.count,
        reviews: reviewed.count,
        credits_consumed: (-consumed.sum(:delta)).fdiv(::Billing::POINTS_PER_CREDIT).round(2),
        acting_users: acting_users,
        actions: created.count + generated.count + reviewed.count
      }
    end

    def users_summary
      total = User.count
      paying = paying_users

      {
        total: total,
        new_in_period: User.where(created_at: @period.range).count,
        new_in_previous: User.where(created_at: @previous_range).count,
        paying: paying,
        # 有料に至った割合。母数は登録した全員（期間で切らない＝累積の転換率）
        free_to_paid_cvr: ratio(paying, total)
      }
    end

    # 支払っている人。お試し中（trialing）はまだお金が入っていないので数に入れない。
    def paying_users
      live_subscriptions.where(status: "active").distinct.count(:user_id)
    end

    # テストで作った契約を本物と混ぜない（決済側 credit_transactions.livemode と同じ扱い）。
    def live_subscriptions
      Subscription.where(status: %w[active trialing], livemode: true)
    end

    def revenue_summary
      current = finance_for(@from, @to)
      previous = finance_for(@previous_from, @from)
      revenue = current[:revenue][:total]
      paying = paying_users

      {
        total_jpy: revenue,
        previous_total_jpy: previous[:revenue][:total],
        # 契約が続くかぎり毎月入る額。買い切りは含めない（次の月に入る保証が無い）
        mrr_jpy: mrr_jpy,
        arr_jpy: mrr_jpy * 12,
        # 1人あたり。母数を取り違えると意味が変わるので、両方出して画面で並べる
        arpu_jpy: divide(revenue, User.count),
        arppu_jpy: divide(revenue, paying),
        test_revenue_jpy: current[:test_revenue]
      }
    end

    def mrr_jpy
      @mrr_jpy ||= live_subscriptions.where(status: "active").joins(:plan).sum("plans.price_cents")
    end

    # 解約。母数は「期間の初めに契約していた人」。
    #
    # 契約が1件も無いうちは割合を出さない（0件を 0% と書くと、
    # 解約が起きていないのか、そもそも契約が無いのかが読めない）。
    def retention_summary
      canceled = Subscription.where(livemode: true, canceled_at: @period.range).count
      at_start = Subscription.where(livemode: true)
                             .where(started_at: ...@from)
                             .where("canceled_at IS NULL OR canceled_at >= ?", @from)
                             .count

      {
        canceled_in_period: canceled,
        active_at_period_start: at_start,
        churn_rate: at_start.positive? ? ratio(canceled, at_start) : nil,
        note: at_start.zero? ? "期間の初めに有料契約が無いため、解約率は出せない" : nil
      }
    end

    # 原価と粗利。計算は収支ページ（FinanceService）と同じものを使う。
    # ここで別に足し直すと、同じ画面に同じ名前の違う数字が並ぶ。
    def unit_economics
      finance = finance_for(@from, @to)
      paying = paying_users

      {
        ai_cost_jpy: finance[:cost][:image][:jpy] + finance[:cost][:text][:jpy],
        ai_cost_per_user_jpy: divide(finance[:cost][:image][:jpy] + finance[:cost][:text][:jpy], User.count),
        gross_profit_jpy: finance[:profit],
        gross_margin: finance[:margin],
        ltv: ltv(paying)
      }
    end

    # LTV。いまは「有料利用者1人あたりの売上 × 平均継続月数」で置く。
    #
    # 解約がまだ起きていない段階では平均継続月数が出せないので、
    # 契約が始まってからの経過月数で代用する。**参考値としてしか使えない。**
    def ltv(paying)
      return { value_jpy: nil, reference: true, basis: "有料利用者がいないため出せない" } if paying.zero?

      arppu = divide(finance_for(@from, @to)[:revenue][:total], paying)
      months = average_subscription_months

      {
        value_jpy: months && arppu ? (arppu * months).round : nil,
        reference: true,
        basis: "ARPPU × 平均継続月数（母数が小さいため参考値）",
        average_months: months
      }
    end

    def average_subscription_months
      rows = live_subscriptions.pluck(:started_at)
      return nil if rows.empty?

      months = rows.map { |started| ((@now - started) / 30.days).round(2) }
      (months.sum / months.size).round(2)
    end

    def finance_for(from, to)
      @finance_cache ||= {}
      @finance_cache[[ from, to ]] ||= ::Admin::FinanceService.new(from: from, to: to).call
    end

    # 割合（%）。母数が 0 のときは割らずに nil を返す（0.0 と書くと「測って0だった」に見える）
    def ratio(numerator, denominator, scale: 1)
      return nil if denominator.nil? || denominator.zero? || numerator.nil?

      (numerator.fdiv(denominator) * 100).round(scale)
    end

    # 1人あたりの額。母数が 0 のときは nil
    def divide(total, count)
      return nil if count.nil? || count.zero?

      (total.fdiv(count)).round
    end

    # 1人あたりの回数（割合ではないので 100 倍しない）
    def per_capita(total, count)
      return nil if count.nil? || count.zero?

      total.fdiv(count).round(1)
    end
  end
end
