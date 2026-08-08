require "rails_helper"

RSpec.describe "Api::V1::Admin 収支", type: :request do
  let(:member) { create(:user, :confirmed) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  describe "GET /api/v1/admin/finance" do
    it "一般ユーザーには 403" do
      get "/api/v1/admin/finance", headers: auth_headers_for(member)

      expect(response).to have_http_status(:forbidden)
    end

    it "月を指定して引ける" do
      get "/api/v1/admin/finance", params: { year: 2026, month: 7 }, headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(json_response["summary"]["period"]["year"]).to eq(2026)
      expect(json_response["summary"]["period"]["month"]).to eq(7)
    end

    it "選べる月の一覧を返す" do
      get "/api/v1/admin/finance", headers: admin_headers

      months = json_response["available_months"]
      expect(months).to be_an(Array)
      expect(months.first).to include("year", "month")
    end

    it "開業からの総計を返す" do
      CreditTransaction.create!(user: member, kind: "topup_purchase", delta: 1000, amount_cents: 1_900)

      get "/api/v1/admin/finance", headers: admin_headers

      expect(json_response["totals"]["revenue"]["total"]).to eq(1_900)
      expect(json_response["totals"]["months"]).to be >= 1
    end

    # 総計のインフラは「月額 × 稼働月数」。月額をそのまま出すと過少になる
    it "総計のインフラは稼働月数ぶんを掛ける" do
      # 既定の概算を切って、確かめたい1項目だけ残す
      %w[infra_usd.fly infra_usd.neon infra_usd.workers infra_usd.r2 infra_usd.sentry infra_jpy.domain]
        .each { |key| CostParameter.create!(key: key, value: 0) }
      CostParameter.create!(key: "infra_jpy.other", value: 1_000)
      member.update!(created_at: 3.months.ago)

      get "/api/v1/admin/finance", headers: admin_headers

      totals = json_response["totals"]
      expect(totals["months"]).to eq(4)
      expect(totals["cost"]["infra"]).to eq(4_000)
    end
  end

  describe "PUT /api/v1/admin/finance/parameters/:key" do
    it "単価を変えられ、概算に反映される" do
      put "/api/v1/admin/finance/parameters/fx_usd_jpy",
        params: { parameter: { value: 200 } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:success)
      expect(CostParameter.value_for("fx_usd_jpy")).to eq(200)
    end
  end

  describe "PUT /api/v1/admin/finance/actuals/:year/:month" do
    it "請求実額を入れると乖離が出る" do
      put "/api/v1/admin/finance/actuals/2026/8",
        params: { actual: { openai_jpy: 5_000, infra_jpy: 3_000, other_jpy: 0 } },
        headers: admin_headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["summary"]["actual"]["actual"]).to eq(8_000)
    end
  end
end
