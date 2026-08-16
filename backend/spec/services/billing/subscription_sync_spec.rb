require "rails_helper"

# Stripe の契約を、こちらの控えへ写す。
#
# お支払い管理ページからの解約は、真偽値（`cancel_at_period_end`）ではなく
# 「その日に終わらせる」形（`cancel_at` に期末の時刻）で予約されることがある。
# **真偽値だけを写すと、利用者が解約したのに画面には何も出ない**まま期末を迎える。
# 本番の実地検証で実際にこうなったため、両方を見る。
RSpec.describe Billing::SubscriptionSync do
  let(:user) { create(:user, :confirmed) }
  let!(:plan) do
    Plan.find_or_create_by!(name: "standard") do |p|
      p.assign_attributes(tier: "standard", kind: "subscription", price_cents: 1_480,
                          credits_per_period: 100, currency: "jpy", interval: "month")
    end.tap { |p| p.update!(stripe_price_id: "price_std") }
  end

  def stripe_sub(cancel_at_period_end:, cancel_at: nil, status: "active")
    Stripe::Subscription.construct_from(
      id: "sub_#{SecureRandom.hex(4)}", customer: "cus_x", status: status,
      cancel_at_period_end: cancel_at_period_end, cancel_at: cancel_at, canceled_at: nil,
      livemode: true,
      items: { data: [ { price: { id: "price_std" },
                         current_period_start: Time.current.to_i,
                         current_period_end: 30.days.from_now.to_i } ] }
    )
  end

  it "契約の中身を写す" do
    row = described_class.call(stripe_sub(cancel_at_period_end: false), user: user)

    expect(row.plan).to eq(plan)
    expect(row.status).to eq("active")
    expect(row.livemode).to be(true)
    expect(row.current_period_end).to be > Time.current
  end

  describe "解約の予約" do
    it "真偽値が立っていれば、解約予定として写す" do
      row = described_class.call(stripe_sub(cancel_at_period_end: true), user: user)

      expect(row.cancel_at_period_end).to be(true)
    end

    # ここが本番で取りこぼしていた形
    it "真偽値が false でも、解約予定日が入っていれば解約予定として扱う" do
      row = described_class.call(
        stripe_sub(cancel_at_period_end: false, cancel_at: 30.days.from_now.to_i), user: user
      )

      expect(row.cancel_at_period_end).to be(true)
    end

    it "どちらも無ければ、解約予定ではない" do
      row = described_class.call(stripe_sub(cancel_at_period_end: false), user: user)

      expect(row.cancel_at_period_end).to be(false)
    end

    it "予約しても、すぐには失効させない（期間の終わりまでは有効）" do
      row = described_class.call(
        stripe_sub(cancel_at_period_end: false, cancel_at: 30.days.from_now.to_i), user: user
      )

      expect(row.status).to eq("active")
      expect(row.current_period_end).to be > Time.current
    end
  end

  it "同じ契約を2回写しても、行は増えない" do
    sub = stripe_sub(cancel_at_period_end: false)

    expect { 2.times { described_class.call(sub, user: user) } }.to change(Subscription, :count).by(1)
  end

  # 位はここを唯一の入口にしている。写した直後に、その契約の位まで揃うこと。
  # **同じ user で契約を書いた直後**という、いちばん間違えやすい呼ばれ方でもある
  describe "位の同期" do
    it "契約を写すと、その段の位が付く" do
      RewardDefinition.registry
      described_class.call(stripe_sub(cancel_at_period_end: false), user: user)

      keys = UserReward.held.joins(:reward_definition)
                       .where(user_id: user.id).pluck(:key)
      expect(keys).to include("title_rank_standard")
    end

    # 位のために支払いを止めない。ここが落ちても契約は正しく残る
    it "位の同期が失敗しても、契約は写る" do
      allow(Achievements::SyncPlanTitle).to receive(:call).and_raise(StandardError, "boom")

      row = described_class.call(stripe_sub(cancel_at_period_end: false), user: user)
      expect(row.status).to eq("active")
    end
  end
end
