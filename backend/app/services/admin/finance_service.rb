# frozen_string_literal: true

module Admin
  # 月ごとの支出入の概算。
  #
  # 収入は実績（Stripe の決済額）なので確度が高い。支出は「実回数 × 単価」の概算で、
  # 回数は正確（image_usages / ai_usages）だが単価は設定値なので、そこが誤差になる。
  # だから請求実額（MonthlyActual）を並べ、乖離率を出して単価を直せるようにしてある。
  class FinanceService
    def self.call(year:, month:, costs: nil)
      new(year: year, month: month, costs: costs).call
    end

    # 開業から今までの総計。
    #
    # インフラは月額なので「稼働した月数」を掛ける。これは概算の中でも粗い部分なので、
    # 月数も一緒に返して、何を掛けた結果なのかが画面から分かるようにしておく。
    def self.totals(now: Time.zone.now)
      first = [ User.minimum(:created_at), CreditTransaction.minimum(:created_at) ].compact.min || now
      months = months_between(first, now)
      # 総計も収支ページの面。稼働した月数ぶんをそのまま掛ける（日割りにしない）
      new(from: first.beginning_of_month, to: now.next_month.beginning_of_month,
          costs: CostParameter.table, infra_months: months).call.merge(months: months)
    end

    def self.months_between(from, to)
      ((to.year - from.year) * 12 + (to.month - from.month)) + 1
    end

    # 1年を12で割った、1ヶ月あたりの日数。うるう年ぶんを含めた 365.25 で数える
    DAYS_PER_MONTH = 365.25 / 12

    # 月額の固定費を、日数ぶんへ配る。
    #
    # 「またいだ暦月の数」で数えると、30日を選んだだけでも月の変わり目を
    # またげば2ヶ月ぶんが乗る。**期間を比べるための数字なのに、
    # 選んだ期間の長さと合わない。**
    #
    # 月額 → 年額 → 日額 → 期間ぶん、と配る。
    # 7日で約0.23ヶ月、30日で約0.99ヶ月、90日で約2.96ヶ月、365日で約12ヶ月。
    # 期間を倍にすれば配る額も倍になる。
    def self.allocated_months(days)
      days.to_f * 12 / 365.25
    end

    # from/to で呼ぶとき（経営タブ）は、インフラ費を期間の日数ぶんへ配る。
    # infra_days を渡せばその日数で配る（全期間で、始まる前まで配らないときに使う）。
    def initialize(year: nil, month: nil, from: nil, to: nil, costs: nil, infra_days: nil, infra_months: nil)
      @from = from || Time.zone.local(year, month, 1)
      @to = to || @from.next_month
      @year = year
      @month = month
      # 年月で呼ぶ収支ページは、その月ぶん（1ヶ月）をそのまま乗せる。
      # 月次の実績として見る面なので、按分すると請求と読み比べられなくなる
      @infra_months =
        if year
          1
        elsif infra_months
          infra_months
        else
          self.class.allocated_months(infra_days || ((@to - @from) / 1.day))
        end
      # 単価は同じ値を何十回も参照する。1回読んで使い回す
      @costs = costs || CostParameter.table
    end

    def call
      revenue = revenue_jpy
      refunds = refunds_jpy
      net = revenue + refunds
      # **手数料は Gross に掛ける。** 返金しても、元の決済の処理手数料は戻らない。
      # Net に掛けると、返金するほど手数料が減るという実態と逆の数字になる
      fee = (revenue * @costs.value_for("stripe_fee_rate")).round
      image = image_cost
      text = text_cost
      infra = (@costs.infra_monthly_jpy * @infra_months).round
      estimated_cost = fee + image[:jpy] + text[:jpy] + infra

      {
        period: { year: @year, month: @month, from: @from.to_date, to: (@to - 1.day).to_date },
        revenue: {
          # Gross。**意味を変えない**（返金を差し引かない、これまでどおりの値）
          total: revenue,
          by_kind: revenue_by_kind,
          # 返金。負の値で持つ（画面ではそのままマイナスとして出す）
          refunds: refunds,
          # 手元に残った額
          net: net
        },
        cost: {
          total: estimated_cost,
          stripe_fee: fee,
          image: image,
          text: text,
          infra: infra,
          # インフラ費は使った量ではなく月額の見積り。何ヶ月ぶんを配ったかを添える
          # （経営タブは日割り、収支ページは1ヶ月固定）
          infra_months: @infra_months.round(2)
        },
        # 粗利は Net から引く。返金したぶんは手元に残っていない
        profit: net - estimated_cost,
        margin: net.positive? ? ((net - estimated_cost).fdiv(net) * 100).round(1) : nil,
        actual: actual_comparison(estimated_cost - fee),
        # テストの決済。売上には入れないが、隠すと「決済したのに 0 円」に見える
        test_revenue: test_revenue_jpy,
        mode: ::Billing::Mode.label,
        fx: @costs.value_for("fx_usd_jpy")
      }
    end

    private

    # 実際に入ってきたお金（円）。amount_cents は JPY なので円がそのまま入る。
    #
    # **テストの決済は数えない**。テストも本物と同じ経路で金額まで記録されるので、
    # 分けないと「今月いくら入ったか」を見ているつもりで、自分で叩いた額を見ることになる。
    # livemode が nil の古い行は、本番の決済がまだ無かった時期のもの＝テスト扱いにする。
    # 種別ごとの金額。**1回だけ引いて使い回す。**
    # 売上・返金・内訳はどれもこの1つから出せるので、別々に引くと本数だけが増える
    def amounts_by_kind
      @amounts_by_kind ||=
        CreditTransaction.where(created_at: @from...@to).where.not(amount_cents: nil)
                         .where(livemode: true).group(:kind).sum(:amount_cents)
    end

    # 売上（Gross）。**返金の行は入れない。**
    # 返金を混ぜると「入ってきたお金」が黙って Net の意味に変わる
    def revenue_jpy
      amounts_by_kind.except("refund").values.sum
    end

    def revenue_by_kind
      amounts_by_kind.except("refund")
    end

    # 返金（負の値）。**返金が起きた日で数える**。
    #
    # 元の決済の月へ遡って引き直さない。運営が見るのは「その月に何が起きたか」で、
    # 過去の月の数字が後から動くと、一度読んだ数字が信じられなくなる。
    # 決済と返金が別の月にまたがるときは、それぞれの月に別々に立つ。
    def refunds_jpy
      amounts_by_kind["refund"].to_i
    end

    # 期間内に記録された、テストの決済の額。0 でなければ画面に断りを出す
    def test_revenue_jpy
      CreditTransaction.where(created_at: @from...@to).where.not(amount_cents: nil)
                       .where(livemode: [ false, nil ]).where.not(kind: "refund").sum(:amount_cents)
    end

    # 画像は「枚数 × 1枚あたりの単価」。モデルと品質ごとに単価が違う。
    #
    # image_usages は 2026-08-09 に入れたもので、それ以前の生成は記録が無い。
    # カード画像だけは shared_medias（キャッシュミス＝実際に呼んだ回数）から拾えるので、
    # モデル・品質ごとに「多い方」を採る。記録前は shared_medias、記録後は image_usages が
    # 上回るので、移行期に二重計上しない。
    # ※アバター・カバー・ポイントは記録前のぶんを拾えない（当時の記録が無いため）
    def image_cost
      fx = @costs.value_for("fx_usd_jpy")
      # キャッシュで済んだぶんは API を呼んでいないので原価に数えない
      usages = ImageUsage.billed.between(@from, @to).group(:model, :quality, :kind).count
      item_counts = merged_item_counts(usages)

      rows = item_counts.map { |(model, quality), count| [ [ model, quality, "item" ], count ] }
      rows += usages.reject { |(_, _, kind), _| kind == "item" }.to_a

      breakdown = rows.map do |(model, quality, kind), count|
        usd = @costs.image_unit_usd(model: model, quality: quality) * count
        { model: model, quality: quality, kind: kind, count: count, usd: usd.round(4), jpy: (usd * fx).round }
      end

      {
        count: breakdown.sum { |row| row[:count] },
        jpy: breakdown.sum { |row| row[:jpy] },
        breakdown: breakdown.sort_by { |row| -row[:jpy] }
      }
    end

    # カード画像の枚数。記録（image_usages）と共有画像（shared_medias）の多い方を採る
    def merged_item_counts(usages)
      from_usages = usages.select { |(_, _, kind), _| kind == "item" }
                          .transform_keys { |(model, quality, _)| [ model, quality ] }

      counts = shared_media_counts
      from_usages.each do |key, count|
        counts[key] = [ counts[key].to_i, count ].max
      end
      counts
    end

    # 共有画像の metadata からモデル・品質を数える（記録を入れる前の期間の手当て）
    def shared_media_counts
      SharedMedia.where(created_at: @from...@to).pluck(:metadata).each_with_object({}) do |metadata, acc|
        key = [ metadata["model"], metadata["quality"] ]
        acc[key] = acc[key].to_i + 1
      end
    end

    # 文章はトークン数 × 100万トークンあたりの単価。入力と出力で単価が違う
    def text_cost
      rows = AiUsage.where(created_at: @from...@to)
                    .group(:model)
                    .pluck(
                      Arel.sql("model"),
                      Arel.sql("COALESCE(SUM(prompt_tokens), 0)"),
                      Arel.sql("COALESCE(SUM(completion_tokens), 0)"),
                      Arel.sql("COUNT(*)")
                    )
      fx = @costs.value_for("fx_usd_jpy")

      breakdown = rows.map do |model, prompt_tokens, completion_tokens, count|
        usd = (prompt_tokens.to_f / 1_000_000) * @costs.value_for("text_in_usd.#{model}") +
              (completion_tokens.to_f / 1_000_000) * @costs.value_for("text_out_usd.#{model}")
        {
          model: model, calls: count,
          prompt_tokens: prompt_tokens, completion_tokens: completion_tokens,
          usd: usd.round(4), jpy: (usd * fx).round
        }
      end

      {
        calls: breakdown.sum { |row| row[:calls] },
        jpy: breakdown.sum { |row| row[:jpy] },
        breakdown: breakdown.sort_by { |row| -row[:jpy] }
      }
    end

    # 概算（決済手数料を除いた外部への支払い）と請求実額を並べる。
    # 手数料は売上から自動で引かれ請求書に出ないので、比較からは外す
    def actual_comparison(estimated_external)
      actual = MonthlyActual.for_period(@year, @month)
      return { recorded: false, estimated: estimated_external } if actual.nil?

      diff = actual.total_jpy - estimated_external
      {
        recorded: true,
        estimated: estimated_external,
        actual: actual.total_jpy,
        openai: actual.openai_jpy,
        infra: actual.infra_jpy,
        other: actual.other_jpy,
        diff: diff,
        diff_rate: estimated_external.positive? ? (diff.fdiv(estimated_external) * 100).round(1) : nil,
        note: actual.note
      }
    end
  end
end
