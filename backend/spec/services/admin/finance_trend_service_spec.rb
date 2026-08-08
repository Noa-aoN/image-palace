require "rails_helper"

RSpec.describe Admin::FinanceTrendService do
  let(:user) { create(:user, :confirmed) }
  let(:now) { Time.zone.local(2026, 8, 15, 12, 0, 0) }

  before do
    travel_to(now)
    CostParameter.create!(key: "fx_usd_jpy", value: 150)
    CostParameter.create!(key: "image_usd.gpt-image-1.medium", value: 0.04)
    CostParameter.create!(key: "stripe_fee_rate", value: 0.1)
    # インフラの既定は概算が入っているので、ここでは切って他の項目だけを見る
    %w[infra_usd.fly infra_usd.neon infra_usd.workers infra_usd.r2 infra_usd.sentry infra_jpy.domain].each do |key|
      CostParameter.create!(key: key, value: 0)
    end
  end

  def trend
    described_class.call(now: now)
  end

  it "12か月ぶん返す" do
    expect(trend.size).to eq(12)
    expect(trend.last[:year]).to eq(2026)
    expect(trend.last[:month]).to eq(8)
  end

  it "月ごとに収入と支出を割り当てる" do
    CreditTransaction.create!(user: user, kind: "topup_purchase", delta: 100, amount_cents: 1_000)
    travel_to(now - 2.months) do
      CreditTransaction.create!(user: user, kind: "topup_purchase", delta: 100, amount_cents: 500)
    end

    rows = trend.index_by { |row| [ row[:year], row[:month] ] }
    expect(rows[[ 2026, 8 ]][:revenue]).to eq(1_000)
    expect(rows[[ 2026, 6 ]][:revenue]).to eq(500)
    # 手数料10%
    expect(rows[[ 2026, 8 ]][:cost]).to eq(100)
  end

  it "画像の原価を月ごとに積む" do
    3.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium") }

    row = trend.find { |r| r[:month] == 8 }
    expect(row[:cost]).to eq(18) # 0.04 * 3 * 150
  end

  # 記録を入れる前の期間も共有画像から拾う（FinanceService と同じ扱い）
  it "共有画像からも枚数を拾い、二重に数えない" do
    travel_to(now - 1.month) do
      2.times { |n| SharedMedia.create!(normalized_prompt: "w#{n}", metadata: { "model" => "gpt-image-1", "quality" => "medium" }) }
    end
    travel_to(now) do
      2.times { |n| SharedMedia.create!(normalized_prompt: "x#{n}", metadata: { "model" => "gpt-image-1", "quality" => "medium" }) }
      ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", quality: "medium")
    end

    rows = trend.index_by { |row| row[:month] }
    expect(rows[7][:cost]).to eq(12) # 0.04 * 2 * 150
    expect(rows[8][:cost]).to eq(12) # 記録1件より共有2件が多いので2件ぶん
  end

  # 以前は FinanceService を12回呼んでいて、本番の往復では十数秒かかる計算だった
  it "クエリ数が月数に比例しない" do
    queries = 0
    counter = ->(*, payload) { queries += 1 unless payload[:name].to_s.include?("SCHEMA") }

    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { trend }

    expect(queries).to be < 20
  end
end
