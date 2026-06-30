require "rails_helper"

RSpec.describe "Api::V1::Settings", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "GET /api/v1/settings" do
    it "認証なしでは 401" do
      get "/api/v1/settings", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "設定が無ければ既定値で作成して返す（生成オプションは既定ON）" do
      get "/api/v1/settings", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_meanings"]).to be(true)
      expect(json_response["auto_generate_tags"]).to be(true)
      expect(json_response).to have_key("default_image_style")
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

    it "デフォルト画像スタイルを更新する" do
      patch "/api/v1/settings", params: { setting: { default_image_style: "watercolor" } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["default_image_style"]).to eq("watercolor")
      expect(user.reload.setting.default_image_style).to eq("watercolor")
    end

    it "不正なデフォルト画像スタイルは 422 を返す" do
      patch "/api/v1/settings", params: { setting: { default_image_style: "bogus" } }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "再生成で意味を参考にする既定は ON で、OFF に更新できる" do
      get "/api/v1/settings", headers: headers
      expect(json_response["regenerate_with_meaning"]).to be(true)

      patch "/api/v1/settings", params: { setting: { regenerate_with_meaning: false } }, headers: headers
      expect(response).to have_http_status(:success)
      expect(json_response["regenerate_with_meaning"]).to be(false)
      expect(user.reload.setting.regenerate_with_meaning).to be(false)
    end
  end
end
