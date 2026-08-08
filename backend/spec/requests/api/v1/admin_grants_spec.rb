require "rails_helper"

RSpec.describe "Api::V1::Admin 付与の管理", type: :request do
  let(:member) { create(:user, :confirmed) }
  let(:member_headers) { auth_headers_for(member) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  describe "GET /api/v1/admin/grant_policies" do
    it "一般ユーザーには 403" do
      get "/api/v1/admin/grant_policies", headers: member_headers

      expect(response).to have_http_status(:forbidden)
    end

    it "未設定のものも既定値つきで返す" do
      get "/api/v1/admin/grant_policies", headers: admin_headers

      expect(response).to have_http_status(:success)
      trial = json_response["policies"].find { |row| row["key"] == "trial" }
      expect(trial["amount"]).to eq(Billing::Catalog::TRIAL_CREDITS)
      expect(trial["customized"]).to be(false)
      expect(json_response["item_kinds"]).to include("skin")
    end
  end

  describe "PUT /api/v1/admin/grant_policies/:key" do
    it "付与量を変えられ、監査ログに残る" do
      expect {
        put "/api/v1/admin/grant_policies/trial",
          params: { policy: { amount: 5, enabled: true } }, headers: admin_headers, as: :json
      }.to change(AdminAuditLog, :count).by(1)

      expect(response).to have_http_status(:success)
      expect(json_response["policy"]["amount"]).to eq(5)
      expect(GrantPolicy.amount_for("trial")).to eq(5)
    end

    it "無効にすると配られなくなる" do
      put "/api/v1/admin/grant_policies/monthly_free",
        params: { policy: { enabled: false } }, headers: admin_headers, as: :json

      expect(GrantPolicy.amount_for("monthly_free")).to eq(0)
    end

    it "アイテム付与は種類が無いと弾く" do
      put "/api/v1/admin/grant_policies/welcome_skin",
        params: { policy: { reward_type: "item", amount: 1 } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["errors"].join).to include("アイテム")
    end

    it "アイテム付与を種類つきで登録できる" do
      put "/api/v1/admin/grant_policies/welcome_skin",
        params: { policy: { reward_type: "item", amount: 1, item_kind: "skin" } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["policy"]["item_kind"]).to eq("skin")
    end
  end

  describe "DELETE /api/v1/admin/grant_policies/:key" do
    it "既定へ戻せる" do
      GrantPolicy.create!(key: "trial", amount: 99)

      delete "/api/v1/admin/grant_policies/trial", headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(GrantPolicy.amount_for("trial")).to eq(Billing::Catalog::TRIAL_CREDITS)
    end
  end

  describe "プラン" do
    # プランはアプリ起動時に用意されていることがあるので、あれば使う
    let!(:plan) do
      Plan.find_or_initialize_by(name: "standard").tap do |record|
        record.update!(tier: "standard", kind: "subscription", interval: "month",
                       price_cents: 1_480, credits_per_period: 100)
      end
    end

    it "一覧に粗利率が付く" do
      get "/api/v1/admin/plans", headers: admin_headers

      expect(response).to have_http_status(:success)
      row = json_response["plans"].find { |p| p["name"] == "standard" }
      expect(row["credits_per_period"]).to eq(100)
      expect(row["margin"]).to be > 0
    end

    it "付与量を変えられる" do
      patch "/api/v1/admin/plans/#{plan.id}",
        params: { plan: { credits_per_period: 90 } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:success)
      expect(plan.reload.credits_per_period).to eq(90)
    end

    # 定数とテストで守っていた不変条件を、画面から変えられるようにしても失わないこと
    it "粗利の下限を割る付与は弾く" do
      patch "/api/v1/admin/plans/#{plan.id}",
        params: { plan: { credits_per_period: 500 } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["errors"].join).to include("粗利率")
      expect(plan.reload.credits_per_period).to eq(100)
    end
  end
end
