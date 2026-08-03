require "rails_helper"

RSpec.describe "Api::V1::Billing::AiUsages", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def record(kind:, tokens: 100, points: 0, at: Time.current)
    AiUsage.create!(
      user: user, kind: kind, model: "gpt-4o-mini",
      prompt_tokens: tokens, completion_tokens: 0, cost_points: points, created_at: at
    )
  end

  it "未ログインでは見られない" do
    get "/api/v1/billing/ai_usage", as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "種類ごとの回数・トークン・消費クレジットを返す" do
    record(kind: "meaning", tokens: 100)
    record(kind: "meaning", tokens: 50)
    record(kind: "fact_check", tokens: 900, points: 1)

    get "/api/v1/billing/ai_usage", headers: headers

    expect(response).to have_http_status(:success)
    expect(json_response["total_count"]).to eq(3)
    expect(json_response["total_tokens"]).to eq(1050)
    expect(json_response["total_credits"]).to eq(0.01)

    meaning = json_response["breakdown"].find { |row| row["kind"] == "meaning" }
    expect(meaning["count"]).to eq(2)
    expect(meaning["tokens"]).to eq(150)
    expect(meaning["label"]).to eq("意味・説明の生成")
  end

  it "多く使っている種類から並べる" do
    record(kind: "fact_check")
    3.times { record(kind: "meaning") }

    get "/api/v1/billing/ai_usage", headers: headers

    expect(json_response["breakdown"].map { |row| row["kind"] }).to eq(%w[meaning fact_check])
  end

  it "期間の外は含めない" do
    record(kind: "meaning", at: 40.days.ago)
    record(kind: "meaning")

    get "/api/v1/billing/ai_usage", headers: headers

    expect(json_response["total_count"]).to eq(1)
  end

  it "days で期間を変えられる（上限あり）" do
    record(kind: "meaning", at: 40.days.ago)

    get "/api/v1/billing/ai_usage", params: { days: 60 }, headers: headers
    expect(json_response["days"]).to eq(60)
    expect(json_response["total_count"]).to eq(1)

    get "/api/v1/billing/ai_usage", params: { days: 999 }, headers: headers
    expect(json_response["days"]).to eq(90)
  end

  it "他人の利用は含めない" do
    other = create(:user, :confirmed)
    AiUsage.create!(user: other, kind: "meaning", model: "m", created_at: Time.current)
    record(kind: "meaning")

    get "/api/v1/billing/ai_usage", headers: headers

    expect(json_response["total_count"]).to eq(1)
  end

  it "1日の上限と本日の使用回数を返す" do
    record(kind: "meaning")
    record(kind: "meaning", at: 30.hours.ago)

    get "/api/v1/billing/ai_usage", headers: headers

    expect(json_response["used_today"]).to eq(1)
    expect(json_response["daily_cap"]).to eq(Ai::UsageLimit::DEFAULT_DAILY_CALL_CAP)
  end

  it "まだ使っていなければ空で返す" do
    get "/api/v1/billing/ai_usage", headers: headers

    expect(json_response["total_count"]).to eq(0)
    expect(json_response["breakdown"]).to eq([])
  end
end
