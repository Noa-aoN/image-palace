require "rails_helper"

RSpec.describe "Account avatar", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "POST /api/v1/account/avatar" do
    it "consumes 1 credit, sets pending, and enqueues GenerateAvatarJob" do
      user.ensure_current_period_credits!

      expect {
        expect {
          post "/api/v1/account/avatar",
            params: { avatar: { prompt: "a cute robot", style: "photo" } },
            headers: headers, as: :json
        }.to have_enqueued_job(GenerateAvatarJob)
      }.to change { user.reload.available_credit_points }.by(-Billing::POINTS_PER_CREDIT)

      expect(response).to have_http_status(:accepted)
      expect(user.reload.avatar_generation_status).to eq("pending")
      expect(json_response["avatar_generation_status"]).to eq("pending")
    end

    it "returns 422 and enqueues nothing when out of credits" do
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all
      user.mark_trial_granted!

      expect {
        post "/api/v1/account/avatar", params: { avatar: { prompt: "robot" } }, headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateAvatarJob)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("クレジットが不足しています")
    end

    it "returns 422 for a blank prompt without enqueuing" do
      expect {
        post "/api/v1/account/avatar", params: { avatar: { prompt: "  " } }, headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateAvatarJob)

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "requires authentication" do
      post "/api/v1/account/avatar", params: { avatar: { prompt: "robot" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/account/profile" do
    it "returns the profile with avatar fields" do
      get "/api/v1/account/profile", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response.keys).to include("name", "email", "avatar_url", "avatar_thumb_url", "avatar_generation_status")
    end

    # 「入居日」として画面に出す
    it "アカウントを開いた日を返す" do
      get "/api/v1/account/profile", headers: headers, as: :json

      expect(json_response["created_at"]).to be_present
    end
  end

  describe "PATCH /api/v1/account/profile" do
    it "表示名を変えられる" do
      patch "/api/v1/account/profile", params: { profile: { name: "宮殿の主" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["name"]).to eq("宮殿の主")
      expect(user.reload.name).to eq("宮殿の主")
    end

    # 空にしたら未設定へ戻す（画面側が既定名を出す）
    it "空文字は未設定に戻す" do
      user.update!(name: "元の名前")

      patch "/api/v1/account/profile", params: { profile: { name: "  " } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(user.reload.name).to be_nil
    end

    it "長すぎる名前は弾く" do
      patch "/api/v1/account/profile", params: { profile: { name: "あ" * 51 } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "制御文字は取り除く" do
      patch "/api/v1/account/profile", params: { profile: { name: "宮殿\u0007の主" } }, headers: headers, as: :json

      expect(user.reload.name).to eq("宮殿の主")
    end

    it "未ログインでは変えられない" do
      patch "/api/v1/account/profile", params: { profile: { name: "x" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/account/avatar" do
    it "clears the avatar generation status" do
      user.update!(avatar_generation_status: "completed")

      delete "/api/v1/account/avatar", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(user.reload.avatar_generation_status).to be_nil
    end
  end
end
