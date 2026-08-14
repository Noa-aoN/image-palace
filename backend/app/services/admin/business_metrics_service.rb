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
        unit_economics: unit_economics,
        credit_economics: credit_economics,
        activity_retention: activity_retention,
        regeneration: regeneration
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

    # 作り直し。
    #
    # **作り直しが多い語は、指示が効いていない語。** 1枚ぶんの原価が丸ごと余分にかかる。
    # どの語で何度も作り直しているかが分かれば、指示の作り方を直せる。
    #
    # 数えるのは「そのカードで使った絵の数」。2つ以上あるカードは作り直している。
    def regeneration
      counts = ItemMediaGeneration.group(:item_id).count
      redone = counts.count { |_, n| n > 1 }
      extra = counts.values.sum { |n| n - 1 }

      {
        # 記録を持つカード（この仕組みを入れた日から積まれる）
        tracked_items: counts.size,
        # 1回でも作り直したカード
        redone_items: redone,
        # 余分に作った枚数の合計（そのぶん原価が出ている）
        extra_images: extra,
        extra_cost_jpy: extra_cost_jpy(extra),
        share_of_tracked: ratio(redone, counts.size),
        # いちばん作り直している語（指示を直す手がかり）
        top_items: top_redone(counts)
      }
    end

    def extra_cost_jpy(extra)
      unit = credit_economics_cache[:cost_per_credit_jpy]
      return nil if unit.nil? || extra.zero?

      (unit * extra).round
    end

    # 上位5件。**誰のものかは出さない**（数字を見るのに要らない）
    def top_redone(counts)
      top = counts.select { |_, n| n > 1 }.sort_by { |_, n| -n }.first(5)
      return [] if top.empty?

      titles = Item.where(id: top.map(&:first)).pluck(:id, :title).to_h
      top.map { |id, n| { title: titles[id].to_s, images: n } }
    end

    # 継続率（D1 / D7 / D30）。
    #
    # **登録日の N 日後「ぴったり」その日に活動したか**で数える。
    # 窓を持たせると「D7に来た人」と「D5に来た人」が混ざり、期間を変えたときに比べられない。
    # 学習は毎日とは限らないので、ぴったりの D7 / D30 は低めに出る。傾向として読む。
    #
    # 数えられるのは、その「N 日後」が計測を始めた日以降にある人だけ。
    # 計測より前の日は記録が無く、**来なかったのか測っていないのかを区別できない**。
    # 推定で埋めない。
    RETENTION_DAYS = { d1: 1, d7: 7, d30: 30 }.freeze

    def activity_retention
      started_on = UserActivityDay.measurement_started_on

      {
        measurement_started_on: started_on,
        days: RETENTION_DAYS.transform_values { |days| retention_for(days, started_on) }
      }
    end

    # その日数ぶん経った人（＝答えの出せる人）だけを母数にする
    def retention_for(days, started_on)
      # 「N 日後」が計測開始日以降にあり、かつ今日より前（＝もう過ぎている）人
      cohort = User.where(created_at: ...(@now - days.days))
                   .where("users.created_at >= ?", started_on.to_time - days.days)
      total = cohort.count
      return immature(0) if total.zero?

      returned = UserActivityDay
                 .joins(:user)
                 .where(user_id: cohort.select(:id))
                 .where("user_activity_days.on_date = (users.created_at + make_interval(days => ?))::date", days)
                 .distinct
                 .count(:user_id)

      { cohort: total, returned: returned, rate: ratio(returned, total), mature: true }
    end

    # まだ答えの出せる人がいない。**0% とは書かない**
    def immature(cohort)
      { cohort: cohort, returned: nil, rate: nil, mature: false }
    end

    # 原価と粗利。計算は収支ページ（FinanceService）と同じものを使う。
    # ここで別に足し直すと、同じ画面に同じ名前の違う数字が並ぶ。
    #
    # 内訳をそのまま渡す。合計だけ渡していたときは、AI 原価より粗利の赤字が大きいのに
    # **その差が何なのか画面から辿れなかった**（正体はインフラ費）。
    # 「売上 − 原価の内訳 = 粗利」が画面の上で閉じるように、全部渡す。
    def unit_economics
      finance = finance_for(@from, @to)
      paying = paying_users
      ai_cost = finance[:cost][:image][:jpy] + finance[:cost][:text][:jpy]

      {
        ai_cost_jpy: ai_cost,
        ai_cost_per_user_jpy: divide(ai_cost, User.count),
        gross_profit_jpy: finance[:profit],
        gross_margin: finance[:margin],
        cost_breakdown: cost_breakdown(finance),
        fx_headroom: fx_headroom(ai_cost),
        ltv: ltv(paying)
      }
    end

    # 為替がどこまで動いても採算が持つか。
    #
    # 売る値段は円で、AI の原価はドルで決まる。**円安になるほど、
    # 同じ値段のまま原価だけが上がる。** 気づくのが値上げの直前になると、
    # 利用者には「急に上げた」ようにしか見えない。
    def fx_headroom(ai_cost)
      consumed = credit_economics_cache[:consumed]
      result = ::Billing::FxSensitivity.call(consumed_credits: consumed, ai_cost_jpy: ai_cost)
      tightest = result.tightest
      return nil if tightest.nil?

      {
        fx_rate: result.fx_rate,
        usd_per_credit: result.usd_per_credit.round(4),
        # 実際に使われたぶんから割り出したか、設定値か
        basis: result.basis,
        tightest_plan: tightest[:name],
        break_even_fx: tightest[:break_even_fx],
        margin_floor_fx: tightest[:margin_floor_fx],
        headroom_percent: tightest[:headroom_percent]
      }
    end

    # 粗利の内訳。**足し算がそのまま読める形**で渡す。
    #   売上 −（決済手数料 + 画像 + 文章 + インフラ）= 粗利
    def cost_breakdown(finance)
      {
        revenue_jpy: finance[:revenue][:total],
        stripe_fee_jpy: finance[:cost][:stripe_fee],
        image_jpy: finance[:cost][:image][:jpy],
        text_jpy: finance[:cost][:text][:jpy],
        infra_jpy: finance[:cost][:infra],
        total_jpy: finance[:cost][:total],
        # インフラ費は使った量ではなく月額の見積り。期間が何ヶ月ぶんかで変わる
        infra_months: finance[:cost][:infra_months]
      }
    end

    # クレジットの出入りと、いま抱えているぶん。
    #
    # 台帳（credit_transactions）を唯一の出どころにする。残高の表から数え直すと、
    # 「配った量」と「使われた量」が別の数え方になって合わなくなる。
    #
    # **未使用の残高を「負債」と書かない。** 会計上そう扱えるかは別の判断で、
    # ここは経営の指標として「まだ提供していないぶん」を見るための数字。
    def credit_economics
      credit_economics_cache
    end

    def credit_economics_cache
      @credit_economics_cache ||= build_credit_economics
    end

    def build_credit_economics
      flows = ledger_flows
      consumed = flows[:consumed]
      unit_cost = credit_unit_cost(consumed)
      outstanding = outstanding_credits

      {
        issued: flows[:issued],
        consumed: consumed,
        expired: flows[:expired],
        # いま使われずに残っているぶん（期間ではなく、いまの断面）
        outstanding: outstanding[:total],
        outstanding_free: outstanding[:free],
        outstanding_paid: outstanding[:paid],
        # 1クレジットあたりの実原価。AI の変動費を、その期間に使われた枚数で割る
        cost_per_credit_jpy: unit_cost,
        # まだ提供していないぶんの原価の見当。**負債額ではない**
        estimated_unfulfilled_cost_jpy: unit_cost && (outstanding[:total] * unit_cost).round,
        expiring: expiring_credits,
        # 期間の消費 ÷ 期間の発行。**同じクレジットの追跡ではない**（期間前に配ったぶんの
        # 消費も分子に入る）ので、コホート単位の消化率とは別物。参考値として見る
        consumption_to_issuance: ratio(consumed, flows[:issued])
      }
    end

    # 台帳から、期間内の出入りをまとめて数える（1回の問い合わせ）
    def ledger_flows
      by_kind = CreditTransaction.where(created_at: @period.range).group(:kind).sum(:delta)
      sum_of = ->(kinds) { kinds.sum { |kind| by_kind[kind].to_i } }

      {
        issued: credits(sum_of.call(%w[subscription_grant grant topup_purchase adjustment refund])),
        consumed: credits(-sum_of.call(%w[consumption])),
        expired: credits(-sum_of.call(%w[grant_expire subscription_expire]))
      }
    end

    # いま使われずに残っているぶん。無料由来と有料由来に分ける。
    # 期限切れは含めない（使えないものを「残っている」と数えない）
    def outstanding_credits
      by_kind = CreditGrant.active.group(:kind).sum(:remaining_points)
      free = by_kind.slice(*FREE_GRANT_KINDS).values.sum
      paid = by_kind.except(*FREE_GRANT_KINDS).values.sum
      # 期限を持たない古い入れ物は有料由来（買い切り・月額の当月分）
      legacy = User.sum(:subscription_credits) + User.sum(:topup_credits)

      { total: credits(free + paid + legacy), free: credits(free), paid: credits(paid + legacy) }
    end

    # 無料で配ったぶん。回収の当てがないので、有料由来と混ぜない
    FREE_GRANT_KINDS = %w[trial monthly_free campaign goodwill free_carryover].freeze

    # 期限が近いぶん。3ヶ月の寿命だと、ここが積み上がると一気に失効する
    def expiring_credits
      active = CreditGrant.active
      within = lambda do |days|
        credits(active.where(expires_at: ..(@now + days.days)).sum(:remaining_points))
      end

      total = credits(active.sum(:remaining_points))
      in_30 = within.call(30)

      { within_7_days: within.call(7), within_30_days: in_30, share_of_outstanding: ratio(in_30, total) }
    end

    # 1クレジットあたりの実原価。AI の変動費だけを、その期間に使われた枚数で割る。
    # インフラ費は使った量で変わらないので入れない（枚数で割ると意味が崩れる）
    def credit_unit_cost(consumed)
      return nil if consumed.nil? || consumed.zero?

      finance = finance_for(@from, @to)
      ai_cost = finance[:cost][:image][:jpy] + finance[:cost][:text][:jpy]
      (ai_cost / consumed).round(2)
    end

    # ポイントを表示用のクレジットに直す（1cr = POINTS_PER_CREDIT pt）
    def credits(points)
      points.to_i.fdiv(::Billing::POINTS_PER_CREDIT).round(2)
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

    # インフラ費は選んだ期間の日数ぶんへ配る（月境界をまたいだ回数では変えない）。
    # 前の期間も同じ長さなので、同じ日数を渡す
    def finance_for(from, to)
      @finance_cache ||= {}
      @finance_cache[[ from, to ]] ||=
        ::Admin::FinanceService.new(from: from, to: to, infra_days: @period.allocation_days).call
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
