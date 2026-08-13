# frozen_string_literal: true

module Admin
  # AI へ渡す数字を、こちら側で確定させる。
  #
  # **AI に計算させない。** 前期比も割合も母数もこちらで出し切って渡す。
  # 計算まで任せると、合っているかを確かめる手立てが無いまま数字が出てくる。
  # AI に任せるのは「この数字が何を意味するか」「何から手を付けるか」だけ。
  #
  # 渡さないもの: メールアドレス・氏名・カードの中身・画像・IP。
  # 見立てに要るのは集まった数であって、誰のものかではない。
  class BriefInputBuilder
    def self.call(...)
      new(...).call
    end

    def initialize(period: Period::DEFAULT, now: Time.current)
      @now = now
      @period = Period.resolve(period, now: now)
      @metrics = BusinessMetricsService.call(now: now, period: @period.key)
    end

    def call
      {
        as_of: @now,
        period: { key: @period.key, label: @period.label, from: @period.from, to: @period.to, days: @period.days },
        facts: facts,
        completeness: completeness
      }
    end

    private

    def facts
      revenue = @metrics[:revenue]
      users = @metrics[:users]
      unit = @metrics[:unit_economics]
      credits = @metrics[:credit_economics]
      active = @metrics[:active]
      engagement = @metrics[:engagement]

      [
        fact("売上", revenue[:total_jpy], previous: revenue[:previous_total_jpy], unit: "jpy",
                                          sample: users[:paying], maturity: "measured"),
        fact("MRR", revenue[:mrr_jpy], unit: "jpy", sample: users[:paying], maturity: "measured"),
        fact("粗利", unit[:gross_profit_jpy], unit: "jpy", maturity: "measured"),
        fact("粗利率", unit[:gross_margin], unit: "percent", maturity: unit[:gross_margin] ? "measured" : "not_applicable",
                       note: unit[:gross_margin] ? nil : "売上が0のため出せない"),
        fact("AI原価", unit[:ai_cost_jpy], unit: "jpy", maturity: "measured"),
        fact("インフラ費（期間配賦）", unit[:cost_breakdown][:infra_jpy], unit: "jpy", maturity: "measured",
                                       note: "使った量では変わらない固定費を日数で配ったもの"),
        fact("1クレジットあたりの実原価", credits[:cost_per_credit_jpy], unit: "jpy",
                                          sample: credits[:consumed],
                                          maturity: credits[:cost_per_credit_jpy] ? "measured" : "not_applicable",
                                          note: "画像＋文章の変動費 ÷ 使われた枚数。インフラ費は含めない"),
        fact("配ったクレジット", credits[:issued], unit: "credits", maturity: "measured"),
        fact("使われたクレジット", credits[:consumed], unit: "credits", maturity: "measured"),
        fact("失効したクレジット", credits[:expired], unit: "credits", maturity: "measured"),
        fact("未使用クレジット", credits[:outstanding], unit: "credits", maturity: "measured",
                                 note: "まだ提供していないぶん。会計上の負債と決めつけない"),
        fact("期限30日以内のクレジット", credits[:expiring][:within_30_days], unit: "credits", maturity: "measured"),
        fact("登録者数", users[:total], maturity: "measured"),
        fact("新規登録", users[:new_in_period], previous: users[:new_in_previous], maturity: "measured"),
        fact("支払っている人", users[:paying], maturity: "measured"),
        fact("有料への転換率", users[:free_to_paid_cvr], unit: "percent", sample: users[:total],
                               maturity: users[:free_to_paid_cvr] ? "measured" : "not_applicable"),
        *active_facts(active),
        fact("作られたカード", engagement[:current][:cards_created],
             previous: engagement[:previous][:cards_created], maturity: "measured"),
        fact("生成された画像", engagement[:current][:images_generated],
             previous: engagement[:previous][:images_generated], maturity: "measured"),
        fact("手を動かした人", engagement[:current][:acting_users],
             previous: engagement[:previous][:acting_users], maturity: "measured"),
        *retention_facts
      ].compact
    end

    def active_facts(active)
      %i[dau wau mau].map do |key|
        fact(key.to_s.upcase, active[key], sample: active[:mau],
                                           maturity: active[:measured] ? "measured" : "not_measured",
                                           note: active[:measured] ? "前の期間とは比べられない（最後に来た日しか持たないため）" : "計測前")
      end
    end

    def retention_facts
      retention = @metrics[:activity_retention]
      started_on = retention[:measurement_started_on]

      retention[:days].map do |key, row|
        fact(
          "継続率 #{key.to_s.upcase}",
          row[:rate],
          unit: "percent",
          sample: row[:cohort],
          maturity: row[:mature] ? "measured" : "immature",
          note: row[:mature] ? nil : "#{started_on} から計測。まだ答えの出せる人がいない"
        )
      end
    end

    # 1件ぶんの数字。**前期比も割合も母数も、ここで出し切る。**
    #
    # reliability は「その数字をどれだけ信じてよいか」。母数が小さいほど下げる。
    # 出しておかないと、2人のうち1人が来ただけで 50% と書かれ、強い根拠のように読まれる。
    def fact(name, value, previous: nil, unit: "count", sample: nil, maturity: "measured", note: nil)
      {
        name: name,
        value: value,
        unit: unit,
        previous: previous,
        delta: (value - previous if value.is_a?(Numeric) && previous.is_a?(Numeric)),
        delta_rate: delta_rate(value, previous),
        sample_size: sample,
        maturity: maturity,
        reliability: reliability(maturity, sample),
        note: note
      }.compact
    end

    def delta_rate(value, previous)
      return nil unless value.is_a?(Numeric) && previous.is_a?(Numeric) && !previous.zero?

      ((value - previous).fdiv(previous) * 100).round(1)
    end

    # 母数が小さいうちは、割合が1人の増減で大きく振れる
    def reliability(maturity, sample)
      return "none" if maturity != "measured"
      return "unknown" if sample.nil?
      return "low" if sample < 10
      return "medium" if sample < 100

      "high"
    end

    # 何がどこまで測れているか。**未計測を 0 と読み違えさせないための但し書き。**
    def completeness
      retention = @metrics[:activity_retention]

      {
        retention: {
          measurement_started_on: retention[:measurement_started_on],
          status: retention[:days].transform_values { |row| row[:mature] ? "measured" : "immature" }
        },
        active_users: {
          measurement_started_on: @metrics[:measurement][:last_seen_since],
          comparable_to_previous_period: false
        },
        activation_funnel: { status: "not_implemented", note: "登録→初カード→初イメージ→有料 は既存データから作れるが、まだ出していない" },
        feature_usage: { status: "not_measured" },
        campaign_effect: { status: "not_measured" }
      }
    end
  end
end
