require "rails_helper"

# 価格は、崩れても画面では気づけない。使われるほど損をするだけになる。
# 「上位ほど安い」「原価を割らない」といった性質をここで固定する。
RSpec.describe Billing::Catalog do
  def unit(row) = described_class.unit_price(row)

  describe "採算" do
    it "有料のものはすべて原価を上回る（使われるほど損をしない）" do
      described_class.paid_rows.each do |row|
        expect(unit(row)).to be > described_class::COST_PER_CREDIT,
                             "#{row[:name]} が #{unit(row).round(2)}円/枚 で原価を割っている"
      end
    end

    it "決済手数料を引いても原価を上回る" do
      described_class.paid_rows.each do |row|
        net = unit(row) * (1 - described_class::STRIPE_FEE_RATE)
        expect(net).to be > described_class::COST_PER_CREDIT, "#{row[:name]} が手数料込みで原価を割っている"
      end
    end

    it "上限まで使われても粗利が残る" do
      described_class.paid_rows.each do |row|
        expect(described_class.margin(row)).to be >= described_class::MIN_MARGIN,
                                               "#{row[:name]} の粗利率が #{(described_class.margin(row) * 100).round}%"
      end
    end

    it "原価が見立ての上限（6円）まで上がっても赤字にならない" do
      worst = described_class.paid_rows.min_by { |row| unit(row) }
      expect(unit(worst) * (1 - described_class::STRIPE_FEE_RATE)).to be > 6.0
    end
  end

  describe "月額プランの並び" do
    let(:paid) { described_class::SUBSCRIPTIONS.reject { |row| row[:price].zero? } }

    it "高いプランほど1枚あたりが安い（逆転しない）" do
      rates = paid.map { |row| unit(row) }
      expect(rates).to eq(rates.sort.reverse)
    end

    it "同じ単価のプランを作らない（選ぶ意味が無くなる）" do
      rates = paid.map { |row| unit(row) }
      expect(rates.uniq.size).to eq(rates.size)
    end

    it "月額が高いプランほど付与も多い" do
      prices = paid.map { |row| row[:price] }
      credits = paid.map { |row| row[:credits] }
      expect(prices).to eq(prices.sort)
      expect(credits).to eq(credits.sort)
    end

    it "無料プランで抱える損は上限がある" do
      free = described_class::SUBSCRIPTIONS.find { |row| row[:price].zero? }
      monthly_cost = free[:credits] * described_class::COST_PER_CREDIT
      expect(monthly_cost).to be <= 100
    end
  end

  describe "買い切りの並び" do
    it "枚数が多いほど1枚あたりが安い（逆転しない）" do
      rates = described_class::TOPUPS.map { |row| unit(row) }
      expect(rates).to eq(rates.sort.reverse)
    end

    it "同じ単価のものを作らない" do
      rates = described_class::TOPUPS.map { |row| unit(row) }
      expect(rates.uniq.size).to eq(rates.size)
    end
  end

  describe "Plan として成り立つこと" do
    it "定義どおりに投入できる" do
      described_class.plans.each do |row|
        plan = Plan.find_or_initialize_by(name: row[:name])
        plan.assign_attributes(row.except(:name).merge(currency: "jpy", active: true))
        expect(plan).to be_valid, "#{row[:name]}: #{plan.errors.full_messages.join(', ')}"
      end
    end

    it "名前が重複していない" do
      names = described_class.plans.map { |row| row[:name] }
      expect(names.uniq.size).to eq(names.size)
    end

    it "月額は必ず期間を持ち、買い切りは持たない" do
      described_class.subscription_rows.each { |row| expect(row[:interval]).to eq("month") }
      described_class.topup_rows.each { |row| expect(row[:interval]).to be_nil }
    end

    it "tier は Plan が知っているものだけを使う" do
      described_class.plans.each { |row| expect(Plan::TIERS).to include(row[:tier]) }
    end
  end

  describe "seeds との一致" do
    it "seeds を流すと定義どおりの Plan になる" do
      described_class.plans.each do |row|
        plan = Plan.find_or_initialize_by(name: row[:name])
        plan.update!(row.except(:name).merge(currency: "jpy", active: true))
      end

      described_class.plans.each do |row|
        plan = Plan.find_by(name: row[:name])
        expect(plan.price_cents).to eq(row[:price_cents])
        expect(plan.credits_per_period).to eq(row[:credits_per_period])
      end
    end
  end

  describe "月額と買い切りの関係" do
    # 買い切りは繰り越しの自由がある代わりに割高、月額は続ける代わりに割安。
    # ここが逆転すると「続けるより単発で買う方が得」になり、契約する理由が消える。
    def nearest_topup(credits)
      described_class::TOPUPS.min_by { |row| (row[:credits] - credits).abs }
    end

    let(:paid_plans) { described_class::SUBSCRIPTIONS.reject { |row| row[:price].zero? } }

    it "同じくらいの枚数なら、月額の方が1枚あたり安い" do
      paid_plans.each do |plan|
        topup = nearest_topup(plan[:credits])
        expect(unit(plan)).to be < unit(topup),
                              "#{plan[:name]}(#{unit(plan).round(2)}円/枚) が " \
                              "#{topup[:name]}(#{unit(topup).round(2)}円/枚) より高い"
      end
    end

    it "月額の割安さが分かる程度にはある（誤差ではない）" do
      paid_plans.each do |plan|
        topup = nearest_topup(plan[:credits])
        discount = 1 - (unit(plan) / unit(topup))
        expect(discount).to be >= 0.05, "#{plan[:name]} の割安さが #{(discount * 100).round}%"
      end
    end

    it "いちばん安い買い切りでも、いちばん高い月額より安くはならない" do
      cheapest_topup = described_class::TOPUPS.map { |row| unit(row) }.min
      priciest_plan = paid_plans.map { |row| unit(row) }.max
      expect(cheapest_topup).to be > priciest_plan
    end
  end

  describe "クレジットの寿命" do
    it "前払式支払手段の適用除外に収まる長さにする（6ヶ月以内）" do
      expect(described_class::CREDIT_LIFETIME).to be <= 6.months
    end

    it "使い切れる長さを確保する（短すぎると割引が見せかけになる）" do
      expect(described_class::CREDIT_LIFETIME).to be >= 3.months
    end

    it "いちばん大きい買い切りでも、期限内に無理なく使える量にする" do
      largest = described_class::TOPUPS.max_by { |row| row[:credits] }
      per_day = largest[:credits] / (described_class::CREDIT_LIFETIME / 1.day)
      expect(per_day).to be <= 10
    end
  end
end
