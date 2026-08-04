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
end
