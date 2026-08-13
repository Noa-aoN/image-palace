require "rails_helper"

# インフラの固定費を、選んだ期間へどう配るか。
#
# 「またいだ暦月の数」で数えていたころは、30日を選んだだけでも月の変わり目を
# またげば2ヶ月ぶんが乗った。**期間を比べるための数字なのに、選んだ期間の長さと
# 合わない。** 7/15〜8/13 の粗利が、7/1〜7/30 の倍の赤字に見えていた。
#
# 月額 → 年額 → 日額 → 期間ぶん、と配る。
RSpec.describe "インフラ費の期間配賦" do
  let(:monthly) { 6_020 }

  before do
    # 他の原価は 0 にして、インフラ費だけを見る
    %w[
      infra_usd.fly infra_usd.neon infra_usd.workers infra_usd.r2 infra_usd.sentry
    ].each { |key| CostParameter.create!(key: key, value: 0) }
    CostParameter.create!(key: "infra_jpy.domain", value: monthly)
  end

  def infra_for(from:, to:, infra_days: nil)
    Admin::FinanceService.new(from: from, to: to, infra_days: infra_days).call[:cost][:infra]
  end

  describe "配る月数" do
    it "30日はほぼ1ヶ月ぶん" do
      expect(Admin::FinanceService.allocated_months(30)).to be_within(0.02).of(0.99)
    end

    it "90日はほぼ3ヶ月ぶん" do
      expect(Admin::FinanceService.allocated_months(90)).to be_within(0.05).of(2.96)
    end

    it "7日はその日数ぶんだけ（約0.23ヶ月）" do
      expect(Admin::FinanceService.allocated_months(7)).to be_within(0.01).of(0.23)
    end

    it "365日は12ヶ月ぶん" do
      expect(Admin::FinanceService.allocated_months(365)).to be_within(0.02).of(12.0)
    end

    it "期間を2倍にすれば配る額も2倍" do
      expect(Admin::FinanceService.allocated_months(60))
        .to be_within(0.001).of(Admin::FinanceService.allocated_months(30) * 2)
    end
  end

  describe "月の境界" do
    # ここが今回直したところ。同じ30日なのに、またいだかどうかで額が変わっていた
    it "同じ30日なら、月をまたいでも、またがなくても同額" do
      within_month = infra_for(from: Time.zone.local(2026, 7, 1), to: Time.zone.local(2026, 7, 31))
      across_month = infra_for(from: Time.zone.local(2026, 7, 15), to: Time.zone.local(2026, 8, 14))

      expect(across_month).to eq(within_month)
    end

    it "30日ぶんは月額のおよそ1ヶ月ぶん（2ヶ月ぶんにならない）" do
      across_month = infra_for(from: Time.zone.local(2026, 7, 15), to: Time.zone.local(2026, 8, 14))

      expect(across_month).to be_within(monthly * 0.03).of(monthly)
      expect(across_month).to be < monthly * 1.5
    end
  end

  describe "収支ページ（年月で見る面）" do
    it "総計は稼働した暦月ぶん（日割りにしない）" do
      create(:user, :confirmed, created_at: Time.zone.local(2026, 7, 10))

      totals = travel_to(Time.zone.local(2026, 8, 13)) { Admin::FinanceService.totals }

      expect(totals[:months]).to eq(2)
      expect(totals[:cost][:infra]).to eq(monthly * 2)
    end

    # 月次の実績として請求と読み比べる面なので、按分しない
    it "日数が違う月でも、1ヶ月ぶんのまま" do
      february = Admin::FinanceService.call(year: 2026, month: 2)[:cost]
      march = Admin::FinanceService.call(year: 2026, month: 3)[:cost]

      expect(february[:infra]).to eq(monthly)
      expect(march[:infra]).to eq(monthly)
      expect(february[:infra_months]).to eq(1)
    end
  end

  describe "全期間" do
    it "記録が1件も無ければ配らない（始まっていない期間に費用を乗せない）" do
      period = Admin::Period.resolve("all", now: Time.current)

      expect(period.allocation_days).to eq(0)
      expect(infra_for(from: period.from, to: period.to, infra_days: period.allocation_days)).to eq(0)
    end

    it "記録があれば、その日から今日までのぶんを配る" do
      create(:user, :confirmed, created_at: 60.days.ago)
      period = Admin::Period.resolve("all", now: Time.current)

      expect(period.allocation_days).to be_within(1).of(60)
    end
  end

  describe "選んだ期間と配る日数が食い違わない" do
    { "7d" => 7, "30d" => 30, "90d" => 90, "6m" => 182, "1y" => 365 }.each do |key, days|
      it "#{key} は #{days}日ぶん" do
        period = Admin::Period.resolve(key, now: Time.current)

        expect(period.days).to eq(days)
        expect(period.allocation_days).to eq(days)
      end
    end

    it "月を選んだときは、その月の実日数ぶん" do
      period = Admin::Period.resolve("2026-02", now: Time.zone.local(2026, 8, 13))

      expect(period.allocation_days).to eq(28)
    end
  end

  describe "粗利との噛み合い" do
    let(:now) { Time.zone.local(2026, 8, 13, 12) }

    it "粗利は内訳の引き算と一致する" do
      unit = travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: "30d") }[:unit_economics]
      breakdown = unit[:cost_breakdown]

      expect(breakdown.values_at(:stripe_fee_jpy, :image_jpy, :text_jpy, :infra_jpy).sum)
        .to eq(breakdown[:total_jpy])
      expect(breakdown[:revenue_jpy] - breakdown[:total_jpy]).to eq(unit[:gross_profit_jpy])
    end

    it "売上が無ければ粗利率は出さない" do
      unit = travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: "30d") }[:unit_economics]

      expect(unit[:gross_margin]).to be_nil
    end

    it "粗利率は、その粗利と売上から出す（別計算をしない）" do
      user = create(:user, :confirmed)
      travel_to(now - 3.days) do
        user.credit_transactions.create!(kind: "topup_purchase", delta: 1000,
                                         amount_cents: 100_000, currency: "jpy", livemode: true)
      end

      unit = travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: "30d") }[:unit_economics]
      expected = (unit[:gross_profit_jpy].fdiv(unit[:cost_breakdown][:revenue_jpy]) * 100).round(1)

      expect(unit[:gross_margin]).to eq(expected)
    end
  end
end
