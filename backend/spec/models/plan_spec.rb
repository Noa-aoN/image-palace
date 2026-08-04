require "rails_helper"

RSpec.describe Plan do
  describe "買い切り（Top-up）の階段" do
    # seeds.rb で用意する値。ここを変えたら seeds.rb も直すこと
    LADDER = [
      { name: "topup_10", price: 150, credits: 10 },
      { name: "topup_50", price: 650, credits: 50 },
      { name: "topup_100", price: 1200, credits: 100 },
      { name: "topup_300", price: 3300, credits: 300 },
      { name: "topup_1000", price: 10_000, credits: 1000 }
    ].freeze

    # 画像1枚あたりの原価の見立て（円）。これを割ると売るほど損をする
    COST_PER_CREDIT = 6.0
    # Stripe の決済手数料（日本のカード）
    STRIPE_FEE_RATE = 0.036

    def unit_price(row)
      row[:price].to_f / row[:credits]
    end

    it "枚数が多いほど1枚あたりが安い（逆転しない）" do
      rates = LADDER.map { |row| unit_price(row) }
      expect(rates).to eq(rates.sort.reverse)
      expect(rates.uniq.size).to eq(rates.size)
    end

    it "いちばん安いものでも原価を割らない" do
      cheapest = LADDER.map { |row| unit_price(row) }.min
      expect(cheapest).to be > COST_PER_CREDIT
    end

    it "決済手数料を引いても原価を割らない" do
      cheapest = LADDER.map { |row| unit_price(row) }.min * (1 - STRIPE_FEE_RATE)
      expect(cheapest).to be > COST_PER_CREDIT
    end

    it "月額（standard）より割高に保つ（続けて使う人はサブスクへ寄せる）" do
      standard_rate = 1480.0 / 100
      cheapest = LADDER.map { |row| unit_price(row) }.min
      # いちばん安い買い切りでも、standard の単価を大きく下回らないこと
      expect(cheapest).to be > standard_rate * 0.6
    end

    it "定義した内容が Plan として成り立つ" do
      LADDER.each do |row|
        plan = Plan.find_or_initialize_by(name: row[:name])
        plan.assign_attributes(
          tier: "topup", kind: "one_time", interval: nil,
          price_cents: row[:price], currency: "jpy", credits_per_period: row[:credits], active: true
        )
        expect(plan).to be_one_time
        expect(plan).to be_valid, "#{row[:name]}: #{plan.errors.full_messages.join(', ')}"
      end
    end
  end

  describe "バリデーション" do
    it "名前は重複できない" do
      create(:plan, :topup)
      duplicate = Plan.new(
        name: "topup_100", tier: "topup", kind: "one_time",
        currency: "jpy", credits_per_period: 100, price_cents: 1200
      )
      expect(duplicate).not_to be_valid
    end

    it "付与クレジットは負にできない" do
      plan = Plan.new(
        name: "bogus", tier: "topup", kind: "one_time",
        currency: "jpy", credits_per_period: -1, price_cents: 100
      )
      expect(plan).not_to be_valid
    end

    it "価格は負にできない" do
      plan = Plan.new(
        name: "bogus", tier: "topup", kind: "one_time",
        currency: "jpy", credits_per_period: 10, price_cents: -1
      )
      expect(plan).not_to be_valid
    end

    it "知らない種別は受け付けない" do
      plan = Plan.new(
        name: "bogus", tier: "topup", kind: "とくべつ",
        currency: "jpy", credits_per_period: 10, price_cents: 100
      )
      expect(plan).not_to be_valid
    end
  end
end
