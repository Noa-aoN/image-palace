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

    it "reads subscription/price from the 2025-03+ shape (parent + pricing.price_details)" do
      user
      plan

      handle(id: "evt_inv2", type: "invoice.paid", data: { object: {
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
        lines: { data: [ { pricing: { price_details: { price: "price_std" } } } ] }
      } })

      expect(user.reload.subscription_credits).to eq(100 * Billing::POINTS_PER_CREDIT)
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

  describe "冪等性（Webhook 重複・順序）" do
    let(:topup) { create(:plan, :topup).tap { |p| p.update!(stripe_price_id: "price_topup") } }

    def topup_event(event_id)
      handle(id: event_id, type: "checkout.session.completed", data: { object: {
        mode: "payment", customer: "cus_1", client_reference_id: user.id,
        metadata: { plan_name: topup.name }
      } })
    end

    it "checkout.session.completed(Top-up) は同一 event_id で二重加算しない" do
      user
      topup
      topup_event("evt_dup_topup")
      expect { topup_event("evt_dup_topup") }.not_to(change { user.reload.topup_credits })
      expect(CreditTransaction.where(stripe_event_id: "evt_dup_topup").count).to eq(1)
    end

    it "customer.subscription.updated は重複してもクレジットを変えず破綻しない" do
      sub = create(:subscription, user:, plan:, status: "active", stripe_subscription_id: "sub_u")
      user.update!(subscription_credits: 42)

      payload = { id: "evt_up", type: "customer.subscription.updated", data: { object: {
        id: "sub_u", customer: "cus_1", status: "active", cancel_at_period_end: false, canceled_at: nil,
        items: { data: [ { price: { id: "price_std" }, current_period_end: 1_705_270_400 } ] }
      } } }

      handle(payload)
      expect { handle(payload) }.not_to(change { user.reload.subscription_credits })
      expect(sub.reload.status).to eq("active")
    end
  end

  describe "Free→Paid 引き継ぎ（free_carryover グラント）" do
    let(:free_plan) { create(:plan) } # name=free, credits_per_period=10
    let!(:local_sub) { create(:subscription, user:, plan:, status: "active", stripe_subscription_id: "sub_1") }

    def invoice_paid(event_id)
      handle(id: event_id, type: "invoice.paid", data: { object: {
        customer: "cus_1", subscription: "sub_1",
        lines: { data: [ { price: { id: "price_std" } } ] }
      } })
    end

    it "初回の有料 invoice.paid で Free 残高を期限付きグラントとして引き継ぐ（期限=元Free周期末）" do
      user; plan; free_plan
      user.update!(subscription_credits: 6 * Billing::POINTS_PER_CREDIT)
      user.update_column(:created_at, Time.zone.local(2026, 1, 15, 10))

      travel_to(Time.zone.local(2026, 1, 20, 12)) { invoice_paid("evt_carry1") }

      grant = user.reload.credit_grants.find_by(kind: "free_carryover")
      expect(grant).to be_present
      expect(grant.remaining_points).to eq(6 * Billing::POINTS_PER_CREDIT)
      expect(grant.expires_at).to eq(Time.zone.local(2026, 2, 15, 10))
      expect(user.subscription_credits).to eq(100 * Billing::POINTS_PER_CREDIT)
    end

    it "CAP は Free 月間枠（10cr）を超えない" do
      user; plan; free_plan
      user.update!(subscription_credits: 50 * Billing::POINTS_PER_CREDIT)

      invoice_paid("evt_carry2")

      expect(user.reload.credit_grants.find_by(kind: "free_carryover").remaining_points)
        .to eq(10 * Billing::POINTS_PER_CREDIT)
    end

    it "2回目（更新）の invoice.paid では引き継がない" do
      user; plan; free_plan
      user.update!(subscription_credits: 5 * Billing::POINTS_PER_CREDIT)
      invoice_paid("evt_carry_first")

      expect { invoice_paid("evt_carry_second") }
        .not_to(change { user.credit_grants.where(kind: "free_carryover").count })
    end

    it "Free 残高が 0 なら carryover グラントを作らない（0付与にもしない）" do
      user; plan; free_plan
      user.update!(subscription_credits: 0)

      invoice_paid("evt_carry_zero")

      expect(user.reload.credit_grants.where(kind: "free_carryover")).to be_empty
      expect(user.subscription_credits).to eq(100 * Billing::POINTS_PER_CREDIT) # Paid枠は通常付与
    end
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

  it "reads current_period from items when absent at root (Stripe 2025-03+ API)" do
    user
    plan

    handle(id: "evt_s2", type: "customer.subscription.created", data: { object: {
      id: "sub_2", customer: "cus_1", status: "active",
      cancel_at_period_end: false, canceled_at: nil,
      items: { data: [ {
        price: { id: "price_std" },
        current_period_start: 1_700_000_000, current_period_end: 1_702_592_000
      } ] }
    } })

    sub = Subscription.find_by(stripe_subscription_id: "sub_2")
    expect(sub.current_period_end).to eq(Time.at(1_702_592_000))
    expect(sub.plan).to eq(plan)
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

  describe "宛先が特定できない支払い" do
    # 開発機で checkout し、webhook だけ本番へ届く構成だとこれが起きる。
    # 黙って通すと「払ったのにクレジットが増えない」が誰にも気づかれないまま残る。
    let(:orphan_topup) do
      { id: "evt_orphan1", type: "checkout.session.completed", data: { object: {
        mode: "payment", customer: "cus_unknown", client_reference_id: SecureRandom.uuid,
        metadata: { plan_name: "topup_100" }
      } } }
    end

    it "ユーザーが見つからないときは声を上げる" do
      allow(Rails.logger).to receive(:error)

      handle(orphan_topup)

      expect(Rails.logger).to have_received(:error).with(/UNMATCHED user .*event=evt_orphan1/)
    end

    it "ユーザーが見つからなくてもクレジットは動かさない" do
      user
      expect { handle(orphan_topup) }.not_to(change { user.reload.topup_credits })
      expect(CreditTransaction.where(stripe_event_id: "evt_orphan1")).to be_empty
    end

    it "プランが見つからないときも声を上げる" do
      user
      allow(Rails.logger).to receive(:error)

      handle(id: "evt_orphan2", type: "checkout.session.completed", data: { object: {
        mode: "payment", customer: "cus_1", client_reference_id: user.id,
        metadata: { plan_name: "存在しないプラン" }
      } })

      expect(Rails.logger).to have_received(:error).with(/UNMATCHED plan .*event=evt_orphan2/)
    end

    it "サブスクの請求でも同じように声を上げる" do
      plan
      allow(Rails.logger).to receive(:error)

      handle(id: "evt_orphan3", type: "invoice.paid", data: { object: {
        customer: "cus_unknown", subscription: "sub_x",
        lines: { data: [ { price: { id: "price_std" } } ] }
      } })

      expect(Rails.logger).to have_received(:error).with(/UNMATCHED user .*event=evt_orphan3/)
    end

    it "個人情報はログに載せない" do
      user
      messages = []
      allow(Rails.logger).to receive(:error) { |msg| messages << msg }

      handle(orphan_topup)

      expect(messages.join).not_to include(user.email)
    end
  end
end
