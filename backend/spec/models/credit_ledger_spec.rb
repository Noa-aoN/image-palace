require "rails_helper"

# User のクレジット台帳ロジック（2バケット制：サブスク分は月次リセット、Top-up は繰り越し）。
RSpec.describe "User credit ledger", type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "balances" do
    it "available_credit_points sums both buckets (points)" do
      user.update!(subscription_credits: 30, topup_credits: 5)
      expect(user.available_credit_points).to eq(35)
    end

    it "available_credits shows points as credits (1cr = 100pt)" do
      user.update!(subscription_credits: 150, topup_credits: 50)
      expect(user.available_credits).to eq(2.0)
    end
  end

  describe "#reset_subscription_credits!" do
    it "resets the subscription bucket and logs expire + grant" do
      user.update!(subscription_credits: 7)

      expect {
        user.reset_subscription_credits!(100)
      }.to change { user.reload.subscription_credits }.from(7).to(100)

      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_expire subscription_grant])
      expect(user.topup_credits).to eq(0)
    end

    it "skips the expire log when there is nothing to forfeit" do
      expect {
        user.reset_subscription_credits!(50)
      }.to change(CreditTransaction, :count).by(1)
      expect(user.credit_transactions.last.kind).to eq("subscription_grant")
    end

    it "forfeits without logging a grant when amount is zero (解約時の失効)" do
      user.update!(subscription_credits: 40)

      expect {
        user.reset_subscription_credits!(0)
      }.to change { user.reload.subscription_credits }.from(40).to(0)

      kinds = user.credit_transactions.order(:created_at).pluck(:kind)
      expect(kinds).to eq(%w[subscription_expire]) # 0デルタの subscription_grant は残さない
    end
  end

  describe "#add_topup_credits!" do
    it "adds to the topup bucket and logs a purchase" do
      user.add_topup_credits!(100)
      expect(user.reload.topup_credits).to eq(100)
      expect(user.credit_transactions.last.kind).to eq("topup_purchase")
    end
  end

  describe "#consume_credits!" do
    it "draws from the subscription bucket first, then topup" do
      user.update!(subscription_credits: 3, topup_credits: 10)

      user.consume_credits!(5)

      user.reload
      expect(user.subscription_credits).to eq(0)
      expect(user.topup_credits).to eq(8)
      expect(user.available_credit_points).to eq(8)
      expect(user.credit_transactions.last.kind).to eq("consumption")
      expect(user.credit_transactions.last.delta).to eq(-5)
    end

    it "raises InsufficientCredits and records nothing when balance is too low" do
      user.update!(subscription_credits: 1, topup_credits: 0)

      expect {
        expect { user.consume_credits!(2) }.to raise_error(User::InsufficientCredits)
      }.not_to change(CreditTransaction, :count)
      expect(user.reload.available_credit_points).to eq(1)
    end
  end

  describe "期限付きグラント（credit_grants）" do
    it "available_credit_points に有効グラントを含む" do
      user.update!(subscription_credits: 100, topup_credits: 0)
      user.grant_credits!(50, kind: "free_carryover", expires_at: 30.days.from_now)
      expect(user.available_credit_points).to eq(150)
      expect(user.credit_transactions.last.kind).to eq("grant")
    end

    it "期限切れ・残量0のグラントは集計に含めない" do
      user.grant_credits!(40, kind: "campaign", expires_at: 1.day.ago) # 期限切れ
      user.grant_credits!(0, kind: "campaign")                         # 0は付与されない
      expect(user.grant_credit_points).to eq(0)
    end

    it "消費は グラント(期限の近い順)→サブスク→Top-up の順" do
      user.update!(subscription_credits: 100, topup_credits: 100)
      user.grant_credits!(30, kind: "campaign", expires_at: 10.days.from_now)
      user.grant_credits!(20, kind: "free_carryover", expires_at: 2.days.from_now)

      user.consume_credits!(60) # 20(近) + 30(次) = グラント50、残り10をサブスクから

      user.reload
      expect(user.grant_credit_points).to eq(0)
      expect(user.subscription_credits).to eq(90)
      expect(user.topup_credits).to eq(100)
    end

    it "期限切れグラントは消費対象にならない（スキップしてサブスクから引く）" do
      user.update!(subscription_credits: 100, topup_credits: 0)
      user.grant_credits!(50, kind: "campaign", expires_at: 1.day.ago) # 期限切れ＝消費されない

      user.consume_credits!(30)

      user.reload
      expect(user.subscription_credits).to eq(70) # グラントは使われずサブスクから
      expect(user.credit_grants.where(kind: "campaign").first.remaining_points).to eq(50)
    end

    it "複数グラントを跨いで一部だけ消費する（近い期限から部分消費）" do
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.grant_credits!(20, kind: "free_carryover", expires_at: 2.days.from_now)
      user.grant_credits!(30, kind: "campaign", expires_at: 9.days.from_now)
      g_near = user.credit_grants.find_by(kind: "free_carryover")
      g_far = user.credit_grants.find_by(kind: "campaign")

      user.consume_credits!(35) # near 20 全消費 + far から 15

      expect(g_near.reload.remaining_points).to eq(0)
      expect(g_far.reload.remaining_points).to eq(15)
    end

    it "Top-up は最後に消費される（グラント・サブスクを使い切ってから）" do
      user.update!(subscription_credits: 10, topup_credits: 100)
      user.grant_credits!(5, kind: "goodwill", expires_at: nil)

      user.consume_credits!(20) # grant5 + sub10 + topup5

      user.reload
      expect(user.grant_credit_points).to eq(0)
      expect(user.subscription_credits).to eq(0)
      expect(user.topup_credits).to eq(95)
    end

    it "残高不足（グラント含む合算でも足りない）はマイナスにならず例外・記録なし" do
      user.update!(subscription_credits: 5, topup_credits: 0)
      user.grant_credits!(3, kind: "campaign", expires_at: 1.day.from_now)

      expect {
        expect { user.consume_credits!(20) }.to raise_error(User::InsufficientCredits)
      }.not_to change(CreditTransaction, :count)
      expect(user.reload.available_credit_points).to eq(8) # 5 + 3、減っていない
    end
  end

  describe "#ensure_current_period_credits! (無料枠の lazy 月次付与)" do
    it "grants the free plan allotment in points on a new period" do
      expect {
        user.ensure_current_period_credits!
      }.to change { user.reload.subscription_credits }.from(0).to(10 * Billing::POINTS_PER_CREDIT)
      expect(user.credits_period_start).to be_present
    end

    it "does not re-grant within the same month" do
      user.ensure_current_period_credits!
      expect { user.ensure_current_period_credits! }.not_to(change { user.reload.subscription_credits })
    end

    it "skips the free grant for users with an active paid subscription" do
      create(:subscription, user:, status: "active")
      expect { user.ensure_current_period_credits! }.not_to(change { user.reload.subscription_credits })
    end

    it "skips the free grant for users on a trialing subscription" do
      create(:subscription, user:, status: "trialing")
      expect { user.ensure_current_period_credits! }.not_to(change { user.reload.subscription_credits })
    end

    it "re-grants at each anniversary period (登録日基準で月次)" do
      user.update_column(:created_at, Time.zone.local(2026, 1, 15, 10))

      travel_to(Time.zone.local(2026, 2, 20, 12)) do
        user.ensure_current_period_credits!
        expect(user.reload.credits_period_start).to eq(Time.zone.local(2026, 2, 15, 10))
      end
      user.update_column(:subscription_credits, 0)

      travel_to(Time.zone.local(2026, 3, 20, 12)) do
        expect { user.ensure_current_period_credits! }
          .to change { user.reload.subscription_credits }.from(0).to(10 * Billing::POINTS_PER_CREDIT)
        expect(user.reload.credits_period_start).to eq(Time.zone.local(2026, 3, 15, 10))
      end
    end

    it "next_free_credit_reset_at は現周期＋1ヶ月（登録日基準）" do
      user.update_column(:created_at, Time.zone.local(2026, 1, 15, 10))
      travel_to(Time.zone.local(2026, 6, 20, 12)) do
        expect(user.next_free_credit_reset_at).to eq(Time.zone.local(2026, 7, 15, 10))
      end
    end
  end
end
