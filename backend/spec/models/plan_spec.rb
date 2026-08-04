require "rails_helper"

RSpec.describe Plan do
  # 価格の妥当性（採算・並び）は Billing::Catalog の spec で見る。ここはモデルの制約だけ。
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
