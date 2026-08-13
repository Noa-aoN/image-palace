require "rails_helper"

RSpec.describe Admin::BusinessMetricsService do
  let(:now) { Time.zone.local(2026, 8, 12, 12) }
  let(:plan) { create(:plan, :standard) }

  def call(period: "30d")
    described_class.call(now: now, period: period)
  end

  describe "Active（来た人）" do
    it "計測がまだ無ければ 0 ではなく「未計測」として返す" do
      create(:user, :confirmed)

      result = travel_to(now) { call }

      expect(result[:active][:measured]).to be(false)
      expect(result[:active][:dau]).to be_nil
      expect(result[:active][:mau]).to be_nil
    end

    it "last_seen_at の窓で DAU / WAU / MAU を数える" do
      today = create(:user, :confirmed, last_seen_at: now - 2.hours)
      this_week = create(:user, :confirmed, last_seen_at: now - 3.days)
      this_month = create(:user, :confirmed, last_seen_at: now - 20.days)
      create(:user, :confirmed, last_seen_at: now - 90.days) # どの窓にも入らない
      expect([ today, this_week, this_month ]).to all(be_persisted)

      result = travel_to(now) { call }

      expect(result[:active]).to include(measured: true, dau: 1, wau: 2, mau: 3)
      expect(result[:active][:stickiness]).to eq(33.3) # 1/3
    end

    it "推移の比較はできないと明示する（最後に来た日しか持たないため）" do
      create(:user, :confirmed, last_seen_at: now)

      expect(travel_to(now) { call }[:active][:comparable]).to be(false)
    end

    it "計測開始が期間の途中なら、その旨を返す" do
      create(:user, :confirmed, last_seen_at: now - 1.day)

      result = travel_to(now) { call(period: "90d") }

      expect(result[:measurement][:last_seen_partial]).to be(true)
      expect(result[:measurement][:last_seen_since]).to be_within(1.minute).of(now - 1.day)
    end
  end

  describe "Engagement（使った人）" do
    it "Active とは別に、実際の行動から数える" do
      user = create(:user, :confirmed, last_seen_at: now) # 来ただけの人
      actor = create(:user, :confirmed)
      create(:item, user: actor, created_at: now - 1.day)
      create(:item, user: actor, created_at: now - 2.days)
      expect(user).to be_persisted

      result = travel_to(now) { call }

      expect(result[:active][:dau]).to eq(1)              # 来たのは1人
      expect(result[:engagement][:current][:cards_created]).to eq(2)
      expect(result[:engagement][:current][:acting_users]).to eq(1) # 手を動かしたのは1人
    end

    it "前期間と並べて返す" do
      actor = create(:user, :confirmed)
      create(:item, user: actor, created_at: now - 5.days)   # 今期
      create(:item, user: actor, created_at: now - 40.days)  # 前期（30日前〜60日前）

      result = travel_to(now) { call }

      expect(result[:engagement][:current][:cards_created]).to eq(1)
      expect(result[:engagement][:previous][:cards_created]).to eq(1)
    end
  end

  describe "利用者と売上" do
    it "有料利用者がいなければ、割り算の指標は 0 ではなく nil にする" do
      create(:user, :confirmed)

      result = travel_to(now) { call }

      expect(result[:users][:paying]).to eq(0)
      expect(result[:users][:free_to_paid_cvr]).to eq(0.0)
      expect(result[:revenue][:arppu_jpy]).to be_nil
      expect(result[:revenue][:mrr_jpy]).to eq(0)
    end

    it "本番の有料契約から MRR / ARR を出す（テスト契約は混ぜない）" do
      paying = create(:user, :confirmed)
      tester = create(:user, :confirmed)
      create(:subscription, user: paying, plan: plan, status: "active", livemode: true)
      create(:subscription, user: tester, plan: plan, status: "active", livemode: false)

      result = travel_to(now) { call }

      expect(result[:users][:paying]).to eq(1)
      expect(result[:revenue][:mrr_jpy]).to eq(plan.price_cents)
      expect(result[:revenue][:arr_jpy]).to eq(plan.price_cents * 12)
    end

    it "お試し中は「支払っている人」に数えない" do
      user = create(:user, :confirmed)
      create(:subscription, user: user, plan: plan, status: "trialing", livemode: true)

      expect(travel_to(now) { call }[:users][:paying]).to eq(0)
    end
  end

  describe "解約" do
    it "期間の初めに契約が無ければ、解約率を出さずに理由を返す" do
      result = travel_to(now) { call }

      expect(result[:retention][:churn_rate]).to be_nil
      expect(result[:retention][:note]).to include("解約率は出せない")
    end

    it "期間の初めに契約があれば率を出す" do
      user = create(:user, :confirmed)
      create(:subscription, user: user, plan: plan, status: "canceled", livemode: true,
                            started_at: now - 90.days, canceled_at: now - 5.days)

      result = travel_to(now) { call }

      expect(result[:retention][:active_at_period_start]).to eq(1)
      expect(result[:retention][:canceled_in_period]).to eq(1)
      expect(result[:retention][:churn_rate]).to eq(100.0)
    end
  end

  describe "LTV" do
    it "有料利用者がいなければ、値を作らず理由を返す" do
      result = travel_to(now) { call }

      expect(result[:unit_economics][:ltv][:value_jpy]).to be_nil
      expect(result[:unit_economics][:ltv][:reference]).to be(true)
      expect(result[:unit_economics][:ltv][:basis]).to include("出せない")
    end

    it "出せるときも参考値と明示する" do
      user = create(:user, :confirmed)
      create(:subscription, user: user, plan: plan, status: "active", livemode: true,
                            started_at: now - 60.days)

      ltv = travel_to(now) { call }[:unit_economics][:ltv]

      expect(ltv[:reference]).to be(true)
      expect(ltv[:average_months]).to be_within(0.1).of(2.0)
    end
  end

  it "原価と粗利は収支ページと同じ計算を使う" do
    result = travel_to(now) { call }

    expect(result[:unit_economics]).to include(:ai_cost_jpy, :gross_profit_jpy, :gross_margin)
  end

  describe "粗利の内訳" do
    # 合計だけ渡していたときは、AI 原価より赤字が大きい理由（インフラ費）が
    # 画面から辿れなかった。**足し算が画面の上で閉じる**ことを固定する。
    it "売上 −（決済手数料 + 画像 + 文章 + インフラ）= 粗利 になっている" do
      result = travel_to(now) { call }
      unit = result[:unit_economics]
      breakdown = unit[:cost_breakdown]

      parts = breakdown.values_at(:stripe_fee_jpy, :image_jpy, :text_jpy, :infra_jpy)
      expect(parts.sum).to eq(breakdown[:total_jpy])
      expect(breakdown[:revenue_jpy] - breakdown[:total_jpy]).to eq(unit[:gross_profit_jpy])
    end

    it "AI 原価は画像と文章の合計（内訳から辿れる）" do
      unit = travel_to(now) { call }[:unit_economics]

      expect(unit[:ai_cost_jpy])
        .to eq(unit[:cost_breakdown][:image_jpy] + unit[:cost_breakdown][:text_jpy])
    end

    it "インフラ費は何ヶ月ぶんを足したかを添える（使った量ではなく月額の見積りのため）" do
      unit = travel_to(now) { call(period: "30d") }[:unit_economics]

      expect(unit[:cost_breakdown][:infra_months]).to be_present
    end

    it "売上が無ければ粗利率は 0% ではなく出さない" do
      unit = travel_to(now) { call }[:unit_economics]

      expect(unit[:cost_breakdown][:revenue_jpy]).to eq(0)
      expect(unit[:gross_margin]).to be_nil
    end

    it "売上があれば粗利率を出す" do
      user = create(:user, :confirmed)
      travel_to(now - 3.days) do
        user.credit_transactions.create!(kind: "topup_purchase", delta: 1000,
                                         amount_cents: 100_000, currency: "jpy", livemode: true)
      end

      unit = travel_to(now) { call }[:unit_economics]

      expect(unit[:cost_breakdown][:revenue_jpy]).to eq(100_000)
      expect(unit[:gross_margin]).to be_a(Numeric)
    end
  end
end
