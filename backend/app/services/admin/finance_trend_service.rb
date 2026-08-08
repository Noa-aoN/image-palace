# frozen_string_literal: true

module Admin
  # 直近12か月の収支の推移。
  #
  # 以前は FinanceService を月の数だけ呼んでいた。1回あたり十数クエリなので、
  # 12か月ぶんで200クエリ近くなる。本番の DB は往復 69ms あるため、
  # それだけで十数秒かかる計算だった。
  #
  # ここでは月ごとに集計した結果を数クエリで取り、掛け算だけ Ruby でやる。
  class FinanceTrendService
    MONTHS = 12

    def self.call(now: Time.zone.now, costs: nil, months: MONTHS)
      new(now: now, costs: costs, months: months).call
    end

    def initialize(now:, costs: nil, months: MONTHS)
      @now = now
      @months = months
      @from = (now - (months - 1).months).beginning_of_month
      @to = now.next_month.beginning_of_month
      @costs = costs || CostParameter.table
    end

    def call
      revenue = revenue_by_month
      image = image_jpy_by_month
      text = text_jpy_by_month
      fee_rate = @costs.value_for("stripe_fee_rate")
      infra = @costs.infra_monthly_jpy.round

      (0...@months).map do |offset|
        date = @from + offset.months
        key = month_key(date)
        month_revenue = revenue[key].to_i
        cost = (month_revenue * fee_rate).round + image[key].to_i + text[key].to_i + infra

        {
          year: date.year,
          month: date.month,
          revenue: month_revenue,
          cost: cost,
          profit: month_revenue - cost
        }
      end
    end

    private

    def month_key(time)
      time.strftime("%Y-%m")
    end

    def revenue_by_month
      CreditTransaction.where(created_at: @from...@to)
                       .where.not(amount_cents: nil)
                       .group(Arel.sql("DATE_TRUNC('month', created_at)"))
                       .sum(:amount_cents)
                       .transform_keys { |key| month_key(key) }
    end

    # 画像は記録（image_usages）と共有画像（shared_medias）の多い方を月ごとに採る。
    # FinanceService と同じ考え方（記録を入れる前の期間を取りこぼさないため）
    def image_jpy_by_month
      fx = @costs.value_for("fx_usd_jpy")
      usages = ImageUsage.between(@from, @to)
                         .group(Arel.sql("DATE_TRUNC('month', created_at)"), :model, :quality, :kind)
                         .count
      shared = shared_counts_by_month

      counts = Hash.new { |hash, key| hash[key] = Hash.new(0) }
      shared.each { |month, rows| rows.each { |key, count| counts[month][key] = count } }
      usages.each do |(month, model, quality, kind), count|
        key = month_key(month)
        if kind == "item"
          counts[key][[ model, quality ]] = [ counts[key][[ model, quality ]], count ].max
        else
          counts[key][[ model, quality, kind ]] = count
        end
      end

      counts.transform_values do |rows|
        rows.sum { |(model, quality, _), count| @costs.image_unit_usd(model: model, quality: quality) * count * fx }.round
      end
    end

    def shared_counts_by_month
      SharedMedia.where(created_at: @from...@to)
                 .pluck(:created_at, :metadata)
                 .each_with_object(Hash.new { |hash, key| hash[key] = Hash.new(0) }) do |(created_at, metadata), acc|
        acc[month_key(created_at)][[ metadata["model"], metadata["quality"] ]] += 1
      end
    end

    def text_jpy_by_month
      fx = @costs.value_for("fx_usd_jpy")
      rows = AiUsage.where(created_at: @from...@to)
                    .group(Arel.sql("DATE_TRUNC('month', created_at)"), :model)
                    .pluck(
                      Arel.sql("DATE_TRUNC('month', created_at)"),
                      Arel.sql("model"),
                      Arel.sql("COALESCE(SUM(prompt_tokens), 0)"),
                      Arel.sql("COALESCE(SUM(completion_tokens), 0)")
                    )

      rows.each_with_object(Hash.new(0)) do |(month, model, prompt_tokens, completion_tokens), acc|
        usd = (prompt_tokens.to_f / 1_000_000) * @costs.value_for("text_in_usd.#{model}") +
              (completion_tokens.to_f / 1_000_000) * @costs.value_for("text_out_usd.#{model}")
        acc[month_key(month)] += (usd * fx).round
      end
    end
  end
end
