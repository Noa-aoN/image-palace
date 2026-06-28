require "rails_helper"

RSpec.describe Plan, type: :model do
  describe "validations" do
    # factory は find_or_create_by! で永続化するため、純粋なバリデーション検証は Plan.new で行う。
    it "rejects an unknown kind" do
      plan = Plan.new(name: "x-#{SecureRandom.hex(4)}", kind: "weird", currency: "jpy", credits_per_period: 0)
      expect(plan).not_to be_valid
      expect(plan.errors[:kind]).to be_present
    end

    it "rejects negative credits_per_period" do
      plan = Plan.new(name: "x-#{SecureRandom.hex(4)}", kind: "subscription", currency: "jpy", credits_per_period: -1)
      expect(plan).not_to be_valid
      expect(plan.errors[:credits_per_period]).to be_present
    end

    it "rejects an annual subscription plan (年額は月次付与の実装まで未対応)" do
      plan = Plan.new(name: "annual-#{SecureRandom.hex(4)}", kind: "subscription",
        interval: "year", currency: "jpy", credits_per_period: 1200)
      expect(plan).not_to be_valid
      expect(plan.errors[:interval]).to be_present
    end

    it "allows a monthly subscription plan" do
      plan = Plan.new(name: "monthly-#{SecureRandom.hex(4)}", kind: "subscription",
        interval: "month", currency: "jpy", credits_per_period: 100)
      expect(plan).to be_valid
    end
  end

  describe "helpers / scopes" do
    it "classifies subscription vs one_time" do
      sub = build(:plan)
      topup = build(:plan, :topup)
      expect(sub.subscription?).to be(true)
      expect(topup.one_time?).to be(true)
    end

    it "treats price 0 as free" do
      expect(build(:plan, price_cents: 0).free?).to be(true)
      expect(build(:plan, :standard).free?).to be(false)
    end
  end
end
