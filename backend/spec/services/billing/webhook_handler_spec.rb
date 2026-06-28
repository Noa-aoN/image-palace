require "rails_helper"

RSpec.describe Billing::WebhookHandler do
  let(:user) { create(:user, :confirmed, stripe_customer_id: "cus_1") }
  let(:plan) { create(:plan, :standard).tap { |p| p.update!(stripe_price_id: "price_std") } }

  # construct_event をスタブして署名検証を素通りさせ、与えた event をそのまま返す。
  def handle(event_hash)
    event = Stripe::Event.construct_from(event_hash)
    allow(Stripe::Webhook).to receive(:construct_event).and_return(event)
    described_class.call(payload: "{}", signature: "sig", secret: "whsec_x")
  end

  it "raises SignatureError on invalid signature" do
    allow(Stripe::Webhook).to receive(:construct_event)
      .and_raise(Stripe::SignatureVerificationError.new("bad", "sig"))

    expect {
      described_class.call(payload: "{}", signature: "bad", secret: "whsec_x")
    }.to raise_error(described_class::SignatureError)
  end

  describe "invoice.paid" do
    let(:payload) do
      { id: "evt_inv1", type: "invoice.paid", data: { object: {
        customer: "cus_1", subscription: "sub_1",
        lines: { data: [ { price: { id: "price_std" } } ] }
      } } }
    end

    it "resets subscription credits to the plan allotment" do
      user
      plan
      handle(payload)
      expect(user.reload.subscription_credits).to eq(100 * Billing::POINTS_PER_CREDIT)
    end

    it "is idempotent on a duplicate event id" do
      user
      plan
      handle(payload)
      expect { handle(payload) }.not_to(change { user.reload.subscription_credits })
      expect(CreditTransaction.where(stripe_event_id: "evt_inv1").count).to eq(1)
    end
  end

  it "adds top-up credits on checkout.session.completed (payment mode)" do
    user
    topup = create(:plan, :topup).tap { |p| p.update!(stripe_price_id: "price_topup") }

    handle(id: "evt_co1", type: "checkout.session.completed", data: { object: {
      mode: "payment", customer: "cus_1", client_reference_id: user.id,
      metadata: { plan_name: topup.name }
    } })

    expect(user.reload.topup_credits).to eq(100 * Billing::POINTS_PER_CREDIT)
  end

  it "upserts a local subscription on customer.subscription.created" do
    user
    plan

    expect {
      handle(id: "evt_s1", type: "customer.subscription.created", data: { object: {
        id: "sub_1", customer: "cus_1", status: "active",
        current_period_start: 1_700_000_000, current_period_end: 1_702_592_000,
        cancel_at_period_end: false, canceled_at: nil,
        items: { data: [ { price: { id: "price_std" } } ] }
      } })
    }.to change(Subscription, :count).by(1)

    sub = Subscription.find_by(stripe_subscription_id: "sub_1")
    expect(sub.user).to eq(user)
    expect(sub.plan).to eq(plan)
    expect(sub.status).to eq("active")
  end

  it "grants credits when a subscription starts trialing on customer.subscription.created" do
    user
    plan

    handle(id: "evt_trial1", type: "customer.subscription.created", data: { object: {
      id: "sub_t1", customer: "cus_1", status: "trialing",
      current_period_start: 1_700_000_000, current_period_end: 1_702_592_000,
      cancel_at_period_end: false, canceled_at: nil,
      items: { data: [ { price: { id: "price_std" } } ] }
    } })

    expect(user.reload.subscription_credits).to eq(100 * Billing::POINTS_PER_CREDIT)
  end

  it "updates current_period_end on customer.subscription.updated (renewal)" do
    create(:subscription, user:, plan:, status: "active", stripe_subscription_id: "sub_1",
      current_period_end: Time.at(1_700_000_000))

    handle(id: "evt_u1", type: "customer.subscription.updated", data: { object: {
      id: "sub_1", customer: "cus_1", status: "active",
      current_period_start: 1_702_592_000, current_period_end: 1_705_270_400,
      cancel_at_period_end: false, canceled_at: nil,
      items: { data: [ { price: { id: "price_std" } } ] }
    } })

    sub = Subscription.find_by(stripe_subscription_id: "sub_1")
    expect(sub.current_period_end).to eq(Time.at(1_705_270_400))
  end

  describe "customer.subscription.deleted" do
    let(:deleted_event) do
      { id: "evt_d1", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } }
    end

    it "forfeits remaining subscription credits and marks canceled" do
      sub = create(:subscription, user:, plan:, status: "active", stripe_subscription_id: "sub_1")
      user.update!(subscription_credits: 50 * Billing::POINTS_PER_CREDIT)

      handle(deleted_event)

      expect(sub.reload.status).to eq("canceled")
      expect(user.reload.subscription_credits).to eq(0)
      expect(CreditTransaction.where(user:, kind: "subscription_expire").count).to eq(1)
    end

    it "is idempotent when the subscription is already canceled" do
      create(:subscription, user:, plan:, status: "active", stripe_subscription_id: "sub_1")
      user.update!(subscription_credits: 50 * Billing::POINTS_PER_CREDIT)
      handle(deleted_event)

      expect {
        handle(id: "evt_d2", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } })
      }.not_to(change { CreditTransaction.where(user:, kind: "subscription_expire").count })
    end
  end
end
