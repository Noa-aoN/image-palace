require "rails_helper"

# 作りかけの機能を、どこまで見せるかの設定。
# デプロイ無しで出し入れできることが要点なので、既定と上書きの関係を固定する。
RSpec.describe "機能の見せ方", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "owner") }
  let(:admin_headers) { auth_headers_for(admin) }

  describe "GET /api/v1/features" do
    it "行が無ければコード側の既定を返す" do
      get "/api/v1/features", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["features"]).to eq(
        FeatureFlag::DEFAULTS.transform_values { |d| d[:stage] }
      )
    end

    it "設定してあればそちらを返す" do
      FeatureFlag.create!(key: "trophy", stage: "hidden")

      get "/api/v1/features", headers: headers

      expect(response.parsed_body.dig("features", "trophy")).to eq("hidden")
    end

    it "認証が要る" do
      get "/api/v1/features"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PUT /api/v1/admin/feature_flags/:key" do
    it "段階を変えられる" do
      # 既定と違う段階を選ぶ（既定と同じ値だと customized が立たない）
      target = (FeatureFlag::STAGES - [ FeatureFlag::DEFAULTS["trophy"][:stage] ]).first

      put "/api/v1/admin/feature_flags/trophy",
          params: { feature: { stage: target } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("feature", "stage")).to eq(target)
      expect(response.parsed_body.dig("feature", "customized")).to be(true)
      expect(FeatureFlag.stages["trophy"]).to eq(target)
    end

    it "操作を監査ログに残す" do
      expect {
        put "/api/v1/admin/feature_flags/trophy",
            params: { feature: { stage: "hidden" } }, headers: admin_headers, as: :json
      }.to change { AdminAuditLog.where(action: "feature_flag_update").count }.by(1)
    end

    # 打ち間違いで「効かない設定」が増えると、直したつもりで直っていない状態になる
    it "画面が知らないキーは受け付けない" do
      put "/api/v1/admin/feature_flags/typo_key",
          params: { feature: { stage: "hidden" } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "知らない段階は受け付けない" do
      put "/api/v1/admin/feature_flags/trophy",
          params: { feature: { stage: "someday" } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "運営でなければ触れない" do
      put "/api/v1/admin/feature_flags/trophy",
          params: { feature: { stage: "hidden" } }, headers: headers, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /api/v1/admin/feature_flags/:key" do
    it "既定へ戻す" do
      FeatureFlag.create!(key: "trophy", stage: "hidden")

      delete "/api/v1/admin/feature_flags/trophy", headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("feature", "stage")).to eq(FeatureFlag::DEFAULTS["trophy"][:stage])
      expect(FeatureFlag.where(key: "trophy")).to be_empty
    end
  end
end
