require "rails_helper"

RSpec.describe Billing::AutoReconciler do
  let(:user) { create(:user, :confirmed, stripe_customer_id: "cus_1") }

  describe ".due?" do
    it "顧客がまだ無ければ確認しない" do
      user.update!(stripe_customer_id: nil)
      expect(described_class.due?(user)).to be(false)
    end

    it "一度も確認していなければ確認する" do
      expect(described_class.due?(user)).to be(true)
    end

    it "確認したばかりなら確認しない（毎回 Stripe を叩かない）" do
      user.update!(stripe_reconciled_at: 1.minute.ago)
      expect(described_class.due?(user)).to be(false)
    end

    it "間隔が空いたら確認する" do
      user.update!(stripe_reconciled_at: (described_class::INTERVAL + 1.minute).ago)
      expect(described_class.due?(user)).to be(true)
    end
  end

  describe ".call" do
    it "確認したら時刻を進める" do
      allow(Billing::CheckoutSyncService).to receive(:call)
        .and_return(Billing::CheckoutSyncService::Result.new(status: "nothing_to_apply", applied: false))

      expect { described_class.call(user) }.to change { user.reload.stripe_reconciled_at }.from(nil)
    end

    it "確認が要らないときは Stripe を呼ばない" do
      user.update!(stripe_reconciled_at: 1.minute.ago)
      allow(Billing::CheckoutSyncService).to receive(:call)

      expect(described_class.call(user)).to be(false)
      expect(Billing::CheckoutSyncService).not_to have_received(:call)
    end

    it "未反映の支払いがあれば反映する" do
      allow(Billing::CheckoutSyncService).to receive(:call)
        .and_return(Billing::CheckoutSyncService::Result.new(status: "paid", applied: true))

      expect(described_class.call(user)).to be(true)
    end

    it "Stripe が落ちていても止まらない（残高が見られなくなる方が困る）" do
      allow(Billing::CheckoutSyncService).to receive(:call).and_raise(Stripe::APIConnectionError.new("down"))

      expect { expect(described_class.call(user)).to be(false) }.not_to raise_error
    end

    it "失敗しても時刻は進める（失敗し続けても叩き続けない）" do
      allow(Billing::CheckoutSyncService).to receive(:call).and_raise(Stripe::APIConnectionError.new("down"))

      described_class.call(user)

      expect(user.reload.stripe_reconciled_at).to be_present
    end
  end
end
