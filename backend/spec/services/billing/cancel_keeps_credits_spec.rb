require "rails_helper"

# 解約しても、受け取ったクレジットは取り上げない。
#
# 規約 第4条の6 は「クレジットの有効期限は、付与された日から3ヶ月間」と定めていて、
# **有料プランで毎月付与されるぶんも同じ**と明記している。
# 解約時に没収すると、その約束と食い違う。
RSpec.describe "解約しても持っているクレジットは残る" do
  let(:user) { create(:user, :confirmed) }
  let!(:plan) do
    Plan.find_or_create_by!(name: "standard") do |p|
      p.assign_attributes(tier: "standard", kind: "subscription", price_cents: 1_480,
                          credits_per_period: 100, currency: "jpy", interval: "month")
    end.tap { |p| p.update!(stripe_price_id: "price_std") }
  end
  let(:subscription) do
    Subscription.create!(user: user, plan: plan, status: "active",
                         stripe_subscription_id: "sub_x", stripe_customer_id: "cus_x",
                         current_period_end: 20.days.from_now, started_at: Time.current)
  end

  # 署名検証を素通りさせ、与えた出来事をそのまま処理させる（既存の spec と同じ形）
  def cancel!
    event = Stripe::Event.construct_from(
      id: "evt_cancel", type: "customer.subscription.deleted",
      data: { object: { id: "sub_x" } }
    )
    allow(Stripe::Webhook).to receive(:construct_event).and_return(event)
    Billing::WebhookHandler.call(payload: "{}", signature: "sig", secret: "whsec_x")
  end

  before do
    subscription
    user.reset_subscription_credits!(100 * Billing::POINTS_PER_CREDIT, subscription: subscription)
  end

  it "解約しても、残っていたぶんは消えない" do
    before_points = user.reload.available_credit_points

    cancel!

    expect(user.reload.available_credit_points).to eq(before_points)
  end

  it "残りは期限付きの持ち越しに移る（期限が来れば自然に失効する）" do
    cancel!

    grant = user.reload.credit_grants.where(kind: "subscription_carryover").last
    expect(grant).to be_present
    expect(grant.remaining_points).to eq(100 * Billing::POINTS_PER_CREDIT)
    expect(grant.expires_at).to be > Time.current
  end

  it "月々の入れ物は空になる（次の付与は止まる）" do
    cancel!

    expect(user.reload.subscription_credits).to eq(0)
    expect(subscription.reload.status).to eq("canceled")
  end

  it "失効の記録は残さない（残高が減っていないため）" do
    expect { cancel! }.not_to change { user.credit_transactions.where(kind: "subscription_expire").count }
  end

  describe "解約したあとも" do
    before { cancel! }

    it "残っているぶんを使える" do
      user.reload.consume_credits!(10 * Billing::POINTS_PER_CREDIT)

      expect(user.reload.available_credit_points).to eq(90 * Billing::POINTS_PER_CREDIT)
    end

    it "買い切りのぶんには影響しない" do
      user.add_topup_credits!(10 * Billing::POINTS_PER_CREDIT)

      expect(user.reload.credit_grants.where(kind: "topup").sum(:remaining_points))
        .to eq(10 * Billing::POINTS_PER_CREDIT)
    end

    # 期限の近いものから使う（FEFO）決まりは変えない
    it "期限の近いものから使う" do
      user.grant_credits!(5 * Billing::POINTS_PER_CREDIT, kind: "campaign", expires_at: 3.days.from_now)

      user.reload.consume_credits!(5 * Billing::POINTS_PER_CREDIT)

      expect(user.reload.credit_grants.where(kind: "campaign").sum(:remaining_points)).to eq(0)
      expect(user.credit_grants.where(kind: "subscription_carryover").sum(:remaining_points))
        .to eq(100 * Billing::POINTS_PER_CREDIT)
    end

    it "期限が来たら失効する" do
      grant = user.credit_grants.where(kind: "subscription_carryover").last
      grant.update_columns(expires_at: 1.hour.ago)

      ExpireCreditGrantsJob.perform_now

      expect(user.reload.available_credit_points).to eq(0)
    end

    it "契約し直すと、古いぶんと新しいぶんが両方使える" do
      user.reset_subscription_credits!(100 * Billing::POINTS_PER_CREDIT, subscription: subscription)

      expect(user.reload.available_credit_points).to eq(200 * Billing::POINTS_PER_CREDIT)
    end
  end
end
