# frozen_string_literal: true

module Billing
  # 「利用と支払い」に出す使用量。期間を選んでまとめる。
  #
  # 数えるものは COUNT / SUM / GROUP BY で DB に数えさせ、返すのは数字だけにする。
  # 日ごとの並びは、無かった日も 0 で埋めて途切れないようにする（グラフの目盛りがずれないため）。
  class UsageSummaryService
    # 選べる期間。month は暦の当月、他は直近 N 日
    PERIODS = {
      "month" => { label: "今月" },
      "30d" => { label: "直近30日", days: 30 },
      "90d" => { label: "直近90日", days: 90 }
    }.freeze
    DEFAULT_PERIOD = "month"

    def self.call(user:, period: DEFAULT_PERIOD, now: Time.current)
      new(user, period, now).call
    end

    def initialize(user, period, now)
      @user = user
      @period = PERIODS.key?(period.to_s) ? period.to_s : DEFAULT_PERIOD
      @now = now
    end

    def call
      {
        period: @period,
        period_label: PERIODS.fetch(@period)[:label],
        since: since,
        until: @now,
        days: day_range.size,
        ai: ai_summary,
        images: images_summary,
        credits: credits_summary,
        items: items_summary
      }
    end

    private

    def since
      @since ||= @period == "month" ? @now.beginning_of_month : @now - PERIODS.fetch(@period)[:days].days
    end

    def day_range
      @day_range ||= (since.to_date..@now.to_date).to_a
    end

    def ai_summary
      rows = AiUsage.where(user_id: @user.id).since(since).group(:kind).pluck(
        Arel.sql("kind"),
        Arel.sql("COUNT(*)"),
        Arel.sql("COALESCE(SUM(prompt_tokens + completion_tokens), 0)"),
        Arel.sql("COALESCE(SUM(cost_points), 0)")
      )
      by_kind = rows.map { |kind, count, tokens, points|
        {
          kind: kind, label: AiUsage.label_for(kind), count: count, tokens: tokens,
          credits: points.fdiv(::Billing::POINTS_PER_CREDIT)
        }
      }.sort_by { |row| -row[:count] }

      {
        total_count: by_kind.sum { |row| row[:count] },
        total_tokens: by_kind.sum { |row| row[:tokens] },
        total_credits: by_kind.sum { |row| row[:credits] },
        daily_cap: Ai::UsageLimit.daily_call_cap,
        used_today: AiUsage.where(user_id: @user.id).since(24.hours.ago).count,
        by_kind: by_kind,
        daily: daily_counts(AiUsage.where(user_id: @user.id))
      }
    end

    # 画像の生成。文章側と違い、キャッシュで済んだぶんも「作った」に数える
    # （API は呼んでいなくてもクレジットは同じだけ消費しているため）。
    # 内訳の cached はその枚数で、原価が掛かっていないことの説明に使う。
    def images_summary
      scope = ImageUsage.where(user_id: @user.id).since(since)
      rows = scope.group(:kind).pluck(
        Arel.sql("kind"),
        Arel.sql("COUNT(*)"),
        Arel.sql("COUNT(*) FILTER (WHERE cached)")
      )
      by_kind = rows.map { |kind, count, cached|
        { kind: kind, label: ImageUsage.label_for(kind), count: count, cached: cached }
      }.sort_by { |row| -row[:count] }

      {
        total_count: by_kind.sum { |row| row[:count] },
        cached_count: by_kind.sum { |row| row[:cached] },
        by_kind: by_kind,
        daily: daily_counts(ImageUsage.where(user_id: @user.id))
      }
    end

    def credits_summary
      scope = @user.credit_transactions.where(kind: "consumption", created_at: since..)
      consumed = -scope.sum(:delta)
      # 消費は負の値で記録されているので、使ったぶんを正の数にして返す
      per_day = scope.group(Arel.sql("DATE(created_at)")).sum(:delta).transform_keys(&:to_s)

      {
        consumed: consumed.fdiv(::Billing::POINTS_PER_CREDIT).round(2),
        daily: day_range.map do |date|
          { date: date.to_s, count: (-per_day[date.to_s].to_i).fdiv(::Billing::POINTS_PER_CREDIT).round(2) }
        end
      }
    end

    def items_summary
      scope = @user.items.where(created_at: since..)
      { created: scope.count, daily: daily_counts(@user.items) }
    end

    def daily_counts(scope)
      counts = scope.where(created_at: since..)
                    .group(Arel.sql("DATE(created_at)"))
                    .count
                    .transform_keys(&:to_s)
      day_range.map { |date| { date: date.to_s, count: counts[date.to_s].to_i } }
    end
  end
end
