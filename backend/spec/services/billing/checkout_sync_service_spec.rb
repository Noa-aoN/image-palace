require "rails_helper"

RSpec.describe Billing::CheckoutSyncService do
  let(:user) { create(:user, :confirmed, stripe_customer_id: "cus_1") }
  let(:topup) { create(:plan, :topup).tap { |p| p.update!(stripe_price_id: "price_topup") } }
  let(:plan) { create(:plan, :standard).tap { |p| p.update!(stripe_price_id: "price_std") } }

  def stub_session(attrs)
    session = Stripe::Checkout::Session.construct_from(attrs)
    allow(Stripe::Checkout::Session).to receive(:retrieve).and_return(session)
    session
  end

  def topup_session(overrides = {})
    {
      id: "cs_test_1", mode: "payment", payment_status: "paid",
      customer: "cus_1", client_reference_id: user.id,
      metadata: { plan_name: topup.name }
    }.merge(overrides)
  end

  describe "買い切り" do
    it "支払い済みならクレジットを入れる" do
      topup
      stub_session(topup_session)

      result = described_class.call(user: user, session_id: "cs_test_1")

      expect(result.status).to eq("paid")
      expect(result.applied).to be(true)
      expect(user.reload.topup_credits).to eq(topup.credits_per_period * Billing::POINTS_PER_CREDIT)
    end

    it "同じ決済を二度取り込んでも増えない" do
      topup
      stub_session(topup_session)
      described_class.call(user: user, session_id: "cs_test_1")

      expect { described_class.call(user: user, session_id: "cs_test_1") }
        .not_to(change { user.reload.topup_credits })
    end

    it "webhook が先に入れていれば、取り込みでは増やさない" do
      topup
      user.add_topup_credits!(
        topup.credits_per_period * Billing::POINTS_PER_CREDIT, stripe_event_id: "cs_test_1"
      )
      stub_session(topup_session)

      result = described_class.call(user: user, session_id: "cs_test_1")

      expect(result.applied).to be(false)
      expect(CreditTransaction.where(stripe_event_id: "cs_test_1").count).to eq(1)
    end

    it "まだ支払われていなければ何もしない" do
      topup
      stub_session(topup_session(payment_status: "unpaid"))

      result = described_class.call(user: user, session_id: "cs_test_1")

      expect(result.status).to eq("unpaid")
      expect(user.reload.topup_credits).to eq(0)
    end

    it "知らないプランなら入れない" do
      stub_session(topup_session(metadata: { plan_name: "存在しないプラン" }))

      expect(described_class.call(user: user, session_id: "cs_test_1").applied).to be(false)
      expect(user.reload.topup_credits).to eq(0)
    end
  end

  describe "他人の決済" do
    it "顧客も参照も一致しなければ拒む" do
      stub_session(topup_session(customer: "cus_other", client_reference_id: SecureRandom.uuid))

      expect { described_class.call(user: user, session_id: "cs_test_1") }
        .to raise_error(described_class::Forbidden)
    end

    it "顧客が一致すれば通す（参照が欠けていても）" do
      topup
      stub_session(topup_session(client_reference_id: nil))

      expect(described_class.call(user: user, session_id: "cs_test_1").applied).to be(true)
    end
  end

  describe "サブスク" do
    let(:stripe_subscription) do
      Stripe::Subscription.construct_from(
        id: "sub_1", customer: "cus_1", status: "active",
        cancel_at_period_end: false, canceled_at: nil, latest_invoice: "in_1",
        items: { data: [ { price: { id: "price_std" }, current_period_start: 1, current_period_end: 2 } ] }
      )
    end

    before do
      plan
      allow(Stripe::Subscription).to receive(:retrieve).and_return(stripe_subscription)
    end

    it "契約をこちらへ写し、請求ぶんのクレジットを入れる" do
      stub_session(id: "cs_sub", mode: "subscription", payment_status: "paid",
                   customer: "cus_1", client_reference_id: user.id, subscription: "sub_1")

      result = described_class.call(user: user, session_id: "cs_sub")

      expect(result.applied).to be(true)
      expect(user.reload.active_subscription&.plan).to eq(plan)
      expect(user.subscription_credits).to eq(plan.credits_per_period * Billing::POINTS_PER_CREDIT)
      expect(CreditTransaction.where(stripe_event_id: "in_1")).to be_present
    end

    it "webhook が先に入れていれば二重に入れない" do
      stub_session(id: "cs_sub", mode: "subscription", payment_status: "paid",
                   customer: "cus_1", client_reference_id: user.id, subscription: "sub_1")
      described_class.call(user: user, session_id: "cs_sub")

      expect { described_class.call(user: user, session_id: "cs_sub") }
        .not_to(change { CreditTransaction.where(stripe_event_id: "in_1").count })
    end
  end

  describe "受け付けないもの" do
    it "決済 id が無ければ NotFound" do
      expect { described_class.call(user: user, session_id: "") }.to raise_error(described_class::NotFound)
    end

    it "Stripe に無い決済なら NotFound" do
      allow(Stripe::Checkout::Session).to receive(:retrieve)
        .and_raise(Stripe::InvalidRequestError.new("no such session", "id"))

      expect { described_class.call(user: user, session_id: "cs_nope") }
        .to raise_error(described_class::NotFound)
    end
  end
end
