require "rails_helper"

RSpec.describe "Api::V1::Rooms", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:space) { user.spaces.create!(name: "英語学習") }

  describe "認証ガード" do
    it "GET rooms returns 401 without auth headers" do
      get "/api/v1/spaces/#{space.id}/rooms", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/spaces/:space_id/rooms" do
    it "returns rooms in the space" do
      space.rooms.create!(name: "単語ルーム")
      space.rooms.create!(name: "文法ルーム")

      get "/api/v1/spaces/#{space.id}/rooms", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      names = json_response.fetch("rooms").map { |r| r["name"] }
      expect(names).to contain_exactly("単語ルーム", "文法ルーム")
    end

    it "rejects access to another users space" do
      other = create(:user, :confirmed)
      other_space = other.spaces.create!(name: "他人")

      get "/api/v1/spaces/#{other_space.id}/rooms", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/spaces/:space_id/rooms" do
    it "creates a room with default layout_type" do
      expect {
        post "/api/v1/spaces/#{space.id}/rooms", params: { room: { name: "新ルーム" } },
          headers: headers, as: :json
      }.to change { space.rooms.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("新ルーム")
      expect(json_response["layout_type"]).to eq("shelf")
      expect(json_response["collection_count"]).to eq(0)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/spaces/#{space.id}/rooms", params: { room: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/spaces/:space_id/rooms/:id" do
    it "returns the room with its collections" do
      room = space.rooms.create!(name: "単語ルーム")
      collection = user.collections.create!(name: "英単語")
      room.collections << collection

      get "/api/v1/spaces/#{space.id}/rooms/#{room.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["collections"].map { |c| c["name"] }).to eq([ "英単語" ])
    end
  end

  describe "PATCH /api/v1/spaces/:space_id/rooms/:id" do
    it "updates the room name" do
      room = space.rooms.create!(name: "旧名")

      patch "/api/v1/spaces/#{space.id}/rooms/#{room.id}", params: { room: { name: "新名" } },
        headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(room.reload.name).to eq("新名")
    end
  end

  describe "DELETE /api/v1/spaces/:space_id/rooms/:id" do
    it "deletes the room" do
      room = space.rooms.create!(name: "消す")

      expect {
        delete "/api/v1/spaces/#{space.id}/rooms/#{room.id}", headers: headers, as: :json
      }.to change { space.rooms.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "ルームへのコレクション配置" do
    it "adds a collection to the room" do
      room = space.rooms.create!(name: "ルーム")
      collection = user.collections.create!(name: "英単語")

      expect {
        post "/api/v1/spaces/#{space.id}/rooms/#{room.id}/collections",
          params: { collection_id: collection.id }, headers: headers, as: :json
      }.to change { room.room_collections.count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "does not add another users collection" do
      room = space.rooms.create!(name: "ルーム")
      other = create(:user, :confirmed)
      other_collection = other.collections.create!(name: "他人")

      post "/api/v1/spaces/#{space.id}/rooms/#{room.id}/collections",
        params: { collection_id: other_collection.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "removes a collection from the room" do
      room = space.rooms.create!(name: "ルーム")
      collection = user.collections.create!(name: "英単語")
      room.collections << collection

      expect {
        delete "/api/v1/spaces/#{space.id}/rooms/#{room.id}/collections/#{collection.id}",
          headers: headers, as: :json
      }.to change { room.room_collections.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
