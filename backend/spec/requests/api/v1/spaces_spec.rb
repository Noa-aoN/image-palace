require "rails_helper"

RSpec.describe "Api::V1::Spaces", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "認証ガード" do
    it "GET /api/v1/spaces returns 401 without auth headers" do
      get "/api/v1/spaces", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/spaces" do
    it "returns the user's spaces ordered by created_at desc" do
      older = user.spaces.create!(name: "古い", created_at: 2.days.ago)
      newer = user.spaces.create!(name: "新しい", created_at: 1.day.ago)

      get "/api/v1/spaces", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      ids = json_response.fetch("spaces").map { |s| s["id"] }
      expect(ids).to eq([ newer.id, older.id ])
    end

    it "does not return other users spaces" do
      user.spaces.create!(name: "自分")
      other = create(:user, :confirmed)
      other.spaces.create!(name: "他人")

      get "/api/v1/spaces", headers: headers, as: :json

      names = json_response.fetch("spaces").map { |s| s["name"] }
      expect(names).to include("自分")
      expect(names).not_to include("他人")
    end
  end

  describe "POST /api/v1/spaces" do
    it "creates a space" do
      expect {
        post "/api/v1/spaces", params: { space: { name: "英語学習", description: "TOEIC対策" } },
          headers: headers, as: :json
      }.to change { user.spaces.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("英語学習")
      expect(json_response["description"]).to eq("TOEIC対策")
      expect(json_response["space_type"]).to eq("room")
    end

    it "creates a road-type space" do
      post "/api/v1/spaces", params: { space: { name: "通勤路", space_type: "road" } }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["space_type"]).to eq("road")
    end

    it "rejects an unknown space_type" do
      post "/api/v1/spaces", params: { space: { name: "x", space_type: "bogus" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/spaces", params: { space: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/spaces/:id" do
    it "returns the space" do
      space = user.spaces.create!(name: "英語学習")

      get "/api/v1/spaces/#{space.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["name"]).to eq("英語学習")
    end

    it "rejects access to another users space" do
      other = create(:user, :confirmed)
      other_space = other.spaces.create!(name: "他人")

      get "/api/v1/spaces/#{other_space.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/spaces/:id" do
    it "updates the space" do
      space = user.spaces.create!(name: "旧名")

      patch "/api/v1/spaces/#{space.id}", params: { space: { name: "新名" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(space.reload.name).to eq("新名")
    end
  end

  describe "DELETE /api/v1/spaces/:id" do
    it "deletes the space" do
      space = user.spaces.create!(name: "消す")

      expect {
        delete "/api/v1/spaces/#{space.id}", headers: headers, as: :json
      }.to change { user.spaces.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
