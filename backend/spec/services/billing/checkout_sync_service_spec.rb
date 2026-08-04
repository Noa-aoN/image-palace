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
    it "Stripe に無い決済なら NotFound" do
      allow(Stripe::Checkout::Session).to receive(:retrieve)
        .and_raise(Stripe::InvalidRequestError.new("no such session", "id"))

      expect { described_class.call(user: user, session_id: "cs_nope") }
        .to raise_error(described_class::NotFound)
    end
  end

  describe "決済 id が分からないとき" do
    def stub_list(*sessions)
      allow(Stripe::Checkout::Session).to receive(:list)
        .and_return(Stripe::ListObject.construct_from(data: sessions.map { |s| Stripe::Checkout::Session.construct_from(s) }))
    end

    it "直近の支払い済みを拾って反映する" do
      topup
      stub_list(topup_session(id: "cs_a"), topup_session(id: "cs_b"))

      result = described_class.call(user: user, session_id: nil)

      expect(result.applied).to be(true)
      expect(user.reload.topup_credits).to eq(2 * topup.credits_per_period * Billing::POINTS_PER_CREDIT)
    end

    it "反映済みのものは素通りする" do
      topup
      stub_list(topup_session(id: "cs_a"))
      described_class.call(user: user, session_id: nil)

      expect { described_class.call(user: user, session_id: nil) }
        .not_to(change { user.reload.topup_credits })
    end

    it "まだ支払われていないものは反映しない" do
      topup
      stub_list(topup_session(id: "cs_a", payment_status: "unpaid"))

      result = described_class.call(user: user, session_id: nil)

      expect(result.status).to eq("nothing_to_apply")
      expect(user.reload.topup_credits).to eq(0)
    end

    it "自分の顧客に紐づくものだけを見る（他人の決済を拾わない）" do
      topup
      allow(Stripe::Checkout::Session).to receive(:list)
        .and_return(Stripe::ListObject.construct_from(data: []))

      described_class.call(user: user, session_id: nil)

      expect(Stripe::Checkout::Session).to have_received(:list)
        .with(hash_including(customer: "cus_1"))
    end

    it "顧客がまだ無ければ何もしない（Stripe を呼ばない）" do
      user.update!(stripe_customer_id: nil)
      allow(Stripe::Checkout::Session).to receive(:list)

      result = described_class.call(user: user, session_id: nil)

      expect(result.status).to eq("no_customer")
      expect(Stripe::Checkout::Session).not_to have_received(:list)
    end
  end
end
