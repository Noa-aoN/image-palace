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
        ai: ai_summary,
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
        admins: User.where(role: %w[admin owner]).count
      }
    end

    def content_summary
      {
        items: Item.count,
        views: View.count,
        spaces: Space.count,
        boxes: Box.count,
        wordlists: Wordlist.count,
        tags: Tag.count
      }
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
