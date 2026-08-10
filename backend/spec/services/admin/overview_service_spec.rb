require "rails_helper"

RSpec.describe Admin::OverviewService do
  let(:user) { create(:user, :confirmed) }
  let(:overview) { described_class.call }

  describe "未使用クレジット" do
    before do
      # 3つの入れ物すべてに残す。どれか1つでも取りこぼすと総量が合わない
      user.update!(subscription_credits: 500, topup_credits: 200)
      user.credit_grants.create!(kind: "trial", amount_points: 300, remaining_points: 300,
                                 expires_at: 3.months.from_now)
      user.credit_grants.create!(kind: "topup", amount_points: 400, remaining_points: 100,
                                 expires_at: 6.months.from_now)
    end

    it "3つの入れ物をすべて数える" do
      # 500 + 200 + 300 + 100 = 1100pt = 11cr
      expect(overview[:credit_liability][:total]).to eq(11.0)
    end

    it "課金の「未使用クレジット」は、未使用クレジット節と同じ数を返す" do
      # 別々に数え直していたころ、期限付きグラントを取りこぼして食い違っていた
      expect(overview[:billing][:outstanding_credits]).to eq(overview[:credit_liability][:total])
    end

    # 単価は Catalog::COST_PER_CREDIT（値付け用の安全側の見立て）ではなく、いまの実費を使う。
    # 収支ページと同じ出どころにして、2つの画面が違う原価を言わないようにする
    it "全部使われたら出ていく原価を、いまの実費で返す" do
      unit = overview[:credit_liability][:credit_unit_cost_jpy]
      costs = CostParameter.table
      model = AiModel.registry.find { |m| m.kind == "image" && m.default_for_kind }

      expect(unit).to eq((costs.image_unit_usd(model: model.model_id) * costs.value_for("fx_usd_jpy")).round(2))
      expect(overview[:credit_liability][:total_cost_jpy]).to eq((11.0 * unit).round)
    end

    it "出どころごとの内訳を返す" do
      breakdown = overview[:credit_liability][:breakdown]

      expect(breakdown[:subscription]).to eq(5.0)
      expect(breakdown[:topup]).to eq(3.0)  # 古い topup_credits 200 + topup グラント 100
      expect(breakdown[:grant]).to eq(3.0)  # trial 300
    end
  end

  describe "契約" do
    let(:plan) { Plan.find_or_create_by!(name: "standard") { |p| p.price_cents = 980; p.tier = "standard" } }

    it "テストで作った契約を、本物と分けて数える" do
      Subscription.create!(user: user, plan: plan, status: "active", started_at: Time.current, livemode: true)
      Subscription.create!(user: create(:user, :confirmed), plan: plan, status: "active",
                           started_at: Time.current, livemode: false)
      # 目印を持たない古い行はテスト扱い
      Subscription.create!(user: create(:user, :confirmed), plan: plan, status: "active", started_at: Time.current)

      billing = overview[:billing]

      expect(billing[:active_subscriptions]).to eq(3)
      expect(billing[:live_subscriptions]).to eq(1)
      expect(billing[:test_subscriptions]).to eq(2)
    end

    it "プラン別に、人数とその月の額を返す" do
      2.times { Subscription.create!(user: create(:user, :confirmed), plan: plan, status: "active", started_at: Time.current) }

      row = overview[:billing][:by_plan].find { |r| r[:name] == "standard" }

      expect(row[:count]).to eq(2)
      expect(row[:mrr_jpy]).to eq(plan.price_cents * 2)
    end

    it "お試し中と、今期末で切れるものを分けて数える" do
      Subscription.create!(user: user, plan: plan, status: "trialing", started_at: Time.current)
      Subscription.create!(user: create(:user, :confirmed), plan: plan, status: "active",
                           started_at: Time.current, cancel_at_period_end: true)

      expect(overview[:billing][:trialing_subscriptions]).to eq(1)
      expect(overview[:billing][:canceling_subscriptions]).to eq(1)
    end
  end

  describe "期間" do
    it "既定は30日。知らない値は既定に丸める" do
      expect(described_class.call[:period][:days]).to eq(30)
      expect(described_class.call(days: 12_345)[:period][:days]).to eq(30)
    end

    it "選べる期間に切り替えられる" do
      expect(described_class.call(days: 7)[:period][:days]).to eq(7)
      expect(described_class.call(days: 90)[:period][:days]).to eq(90)
    end

    it "長い期間でも、折れ線の点は増やしすぎない（傾きが読めなくなる）" do
      points = described_class.call(days: 90)[:series][:new_users].size

      expect(points).to be <= described_class::MAX_SERIES_POINTS
    end
  end
end
