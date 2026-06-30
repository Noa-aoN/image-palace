require "rails_helper"

RSpec.describe CreditGrant, type: :model do
  let(:user) { create(:user, :confirmed) }

  def grant(remaining:, expires_at:, kind: "campaign", amount: nil)
    user.credit_grants.create!(
      kind:, amount_points: amount || remaining, remaining_points: remaining, expires_at:
    )
  end

  describe "validations" do
    it "kind と非負の amount/remaining を要求する" do
      expect(CreditGrant.new(user:, kind: "", amount_points: 1, remaining_points: 1)).to be_invalid
      expect(CreditGrant.new(user:, kind: "campaign", amount_points: -1, remaining_points: 0)).to be_invalid
      expect(CreditGrant.new(user:, kind: "campaign", amount_points: 10, remaining_points: 0)).to be_valid
    end
  end

  describe ".active" do
    it "残量>0 かつ 未期限切れ（期限なし含む）のみ含む" do
      live = grant(remaining: 10, expires_at: 1.day.from_now)
      no_expiry = grant(remaining: 5, expires_at: nil)
      grant(remaining: 10, expires_at: 1.day.ago) # 期限切れ → 除外
      grant(remaining: 0, expires_at: 1.day.from_now) # 残量0 → 除外

      expect(user.credit_grants.active).to contain_exactly(live, no_expiry)
    end
  end

  describe ".consume_order" do
    it "期限の近い順（期限なしは最後）に並ぶ" do
      far = grant(remaining: 10, expires_at: 10.days.from_now)
      near = grant(remaining: 10, expires_at: 2.days.from_now)
      none = grant(remaining: 10, expires_at: nil)

      expect(user.credit_grants.consume_order.to_a).to eq([ near, far, none ])
    end
  end
end
