require "rails_helper"

# User のクレジット台帳ロジック（2バケット制：サブスク分は月次リセット、Top-up は繰り越し）。
RSpec.describe "User credit ledger", type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "#available_credits" do
    it "sums both buckets" do
      user.update!(subscription_credits: 30, topup_credits: 5)
      expect(user.available_credits).to eq(35)
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
      expect(user.available_credits).to eq(8)
      expect(user.credit_transactions.last.kind).to eq("consumption")
      expect(user.credit_transactions.last.delta).to eq(-5)
    end

    it "raises InsufficientCredits and records nothing when balance is too low" do
      user.update!(subscription_credits: 1, topup_credits: 0)

      expect {
        expect { user.consume_credits!(2) }.to raise_error(User::InsufficientCredits)
      }.not_to change(CreditTransaction, :count)
      expect(user.reload.available_credits).to eq(1)
    end
  end
end
