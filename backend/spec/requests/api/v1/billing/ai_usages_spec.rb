require "rails_helper"

RSpec.describe "Api::V1::Billing::AiUsages", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

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

  describe "AIの利用" do
    it "種類ごとの回数・トークン・消費クレジットを返す" do
      record(kind: "meaning", tokens: 100)
      record(kind: "meaning", tokens: 50)
      record(kind: "fact_check", tokens: 900, points: 1)

      get "/api/v1/billing/ai_usage", headers: headers

      expect(response).to have_http_status(:success)
      ai = json_response["ai"]
      expect(ai["total_count"]).to eq(3)
      expect(ai["total_tokens"]).to eq(1050)
      expect(ai["total_credits"]).to eq(0.01)

      meaning = ai["by_kind"].find { |row| row["kind"] == "meaning" }
      expect(meaning["count"]).to eq(2)
      expect(meaning["label"]).to eq("意味・説明の生成")
    end

    it "多く使っている種類から並べる" do
      record(kind: "fact_check")
      3.times { record(kind: "meaning") }

      get "/api/v1/billing/ai_usage", headers: headers

      expect(json_response["ai"]["by_kind"].map { |row| row["kind"] }).to eq(%w[meaning fact_check])
    end

    it "他人の利用は含めない" do
      other = create(:user, :confirmed)
      AiUsage.create!(user: other, kind: "meaning", model: "m", created_at: Time.current)
      record(kind: "meaning")

      get "/api/v1/billing/ai_usage", headers: headers

      expect(json_response["ai"]["total_count"]).to eq(1)
    end

    it "1日の上限と本日の使用回数を返す" do
      record(kind: "meaning")
      record(kind: "meaning", at: 30.hours.ago)

      get "/api/v1/billing/ai_usage", params: { period: "30d" }, headers: headers

      expect(json_response["ai"]["used_today"]).to eq(1)
      expect(json_response["ai"]["daily_cap"]).to eq(Ai::UsageLimit::DEFAULT_DAILY_CALL_CAP)
    end

    it "まだ使っていなければ空で返す" do
      get "/api/v1/billing/ai_usage", headers: headers

      expect(json_response["ai"]["total_count"]).to eq(0)
      expect(json_response["ai"]["by_kind"]).to eq([])
    end
  end

  describe "期間の選択" do
    it "既定は今月（先月ぶんは含めない）" do
      travel_to Time.zone.local(2026, 8, 15, 12) do
        record(kind: "meaning", at: Time.zone.local(2026, 7, 20))
        record(kind: "meaning", at: Time.zone.local(2026, 8, 2))

        get "/api/v1/billing/ai_usage", headers: headers

        expect(json_response["period"]).to eq("month")
        expect(json_response["period_label"]).to eq("今月")
        expect(json_response["ai"]["total_count"]).to eq(1)
      end
    end

    it "直近30日・90日を選べる" do
      travel_to Time.zone.local(2026, 8, 15, 12) do
        record(kind: "meaning", at: Time.zone.local(2026, 7, 20))

        get "/api/v1/billing/ai_usage", params: { period: "30d" }, headers: headers
        expect(json_response["ai"]["total_count"]).to eq(1)

        get "/api/v1/billing/ai_usage", params: { period: "90d" }, headers: headers
        expect(json_response["period_label"]).to eq("直近90日")
      end
    end

    it "知らない期間は今月に丸める" do
      get "/api/v1/billing/ai_usage", params: { period: "全期間" }, headers: headers

      expect(json_response["period"]).to eq("month")
    end
  end

  describe "日ごとの並び" do
    it "使わなかった日も 0 で埋める（目盛りがずれないように）" do
      travel_to Time.zone.local(2026, 8, 10, 12) do
        record(kind: "meaning", at: Time.zone.local(2026, 8, 3, 9))

        get "/api/v1/billing/ai_usage", headers: headers

        daily = json_response["ai"]["daily"]
        expect(daily.size).to eq(10)
        expect(daily.first["date"]).to eq("2026-08-01")
        expect(daily.find { |d| d["date"] == "2026-08-03" }["count"]).to eq(1)
        expect(daily.find { |d| d["date"] == "2026-08-02" }["count"]).to eq(0)
      end
    end
  end

  describe "クレジットの消費とカードの作成" do
    it "消費したクレジットを正の数で返す" do
      user.ensure_current_period_credits!
      user.consume_credits!(::Billing::POINTS_PER_CREDIT)

      get "/api/v1/billing/ai_usage", headers: headers

      expect(json_response["credits"]["consumed"]).to eq(1.0)
      expect(json_response["credits"]["daily"].sum { |d| d["count"] }).to eq(1.0)
    end

    it "作ったカードの数を返す" do
      user.items.create!(title: "あ", item_type: item_type, generation_status: "completed")

      get "/api/v1/billing/ai_usage", headers: headers

      expect(json_response["items"]["created"]).to eq(1)
      expect(json_response["items"]["daily"].sum { |d| d["count"] }).to eq(1)
    end
  end
end
