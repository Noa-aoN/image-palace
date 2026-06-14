require "rails_helper"

RSpec.describe "Api::V1::Settings", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "GET /api/v1/settings" do
    it "認証なしでは 401" do
      get "/api/v1/settings", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "設定が無ければ既定値で作成して返す" do
      get "/api/v1/settings", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_meanings"]).to be(false)
      expect(json_response["auto_generate_tags"]).to be(false)
      expect(user.reload.setting).to be_present
    end
  end

  describe "PATCH /api/v1/settings" do
    it "意味の自動生成設定を更新する" do
      patch "/api/v1/settings", params: { setting: { auto_generate_meanings: true } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_meanings"]).to be(true)
      expect(user.reload.setting.auto_generate_meanings).to be(true)
    end

    it "タグの自動生成設定を更新する" do
      patch "/api/v1/settings", params: { setting: { auto_generate_tags: true } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_tags"]).to be(true)
      expect(user.reload.setting.auto_generate_tags).to be(true)
    end
  end
end
