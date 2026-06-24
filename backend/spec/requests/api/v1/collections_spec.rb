require "rails_helper"

RSpec.describe "Api::V1::Collections", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def create_view(name)
    user.views.create!(name: name, view_type: "deck")
  end

  describe "認証ガード" do
    it "GET /api/v1/collections returns 401 without auth headers" do
      get "/api/v1/collections", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/collections" do
    it "returns the user's collections with entry counts" do
      collection = user.collections.create!(name: "学習")
      collection.collection_entries.create!(entry: create_view("単語"))
      collection.collection_entries.create!(entry: user.spaces.create!(name: "英語"))
      user.collections.create!(name: "空コレクション")

      get "/api/v1/collections", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      collections = json_response.fetch("collections")
      target = collections.find { |c| c["name"] == "学習" }
      expect(target["entry_count"]).to eq(2)
    end

    it "does not return other users collections" do
      user.collections.create!(name: "自分")
      other = create(:user, :confirmed)
      other.collections.create!(name: "他人")

      get "/api/v1/collections", headers: headers, as: :json

      names = json_response.fetch("collections").map { |c| c["name"] }
      expect(names).to include("自分")
      expect(names).not_to include("他人")
    end
  end

  describe "POST /api/v1/collections" do
    it "creates a collection" do
      expect {
        post "/api/v1/collections", params: { collection: { name: "新コレクション" } }, headers: headers, as: :json
      }.to change { user.collections.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["entry_count"]).to eq(0)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/collections", params: { collection: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "GET /api/v1/collections/:id" do
    it "returns mixed entries (card / space / view)" do
      collection = user.collections.create!(name: "学習")
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      collection.collection_entries.create!(entry: item)
      collection.collection_entries.create!(entry: user.spaces.create!(name: "英語スペース"))
      collection.collection_entries.create!(entry: user.views.create!(name: "関係図"))

      get "/api/v1/collections/#{collection.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      types = json_response.fetch("entries").map { |e| e["entry_type"] }
      expect(types).to contain_exactly("Item", "Space", "View")
    end

    it "rejects access to another users collection" do
      other = create(:user, :confirmed)
      other_collection = other.collections.create!(name: "他人")

      get "/api/v1/collections/#{other_collection.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "コレクションへのエントリ追加・削除" do
    it "adds a deck entry" do
      collection = user.collections.create!(name: "学習")
      deck = create_view("単語")

      expect {
        post "/api/v1/collections/#{collection.id}/entries",
          params: { entry_type: "View", entry_id: deck.id }, headers: headers, as: :json
      }.to change { collection.collection_entries.count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "adds a space entry" do
      collection = user.collections.create!(name: "学習")
      space = user.spaces.create!(name: "英語")

      post "/api/v1/collections/#{collection.id}/entries",
        params: { entry_type: "Space", entry_id: space.id }, headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(collection.collection_entries.where(entry_type: "Space").count).to eq(1)
    end

    it "is idempotent when adding the same entry twice" do
      collection = user.collections.create!(name: "学習")
      deck = create_view("単語")
      collection.collection_entries.create!(entry: deck)

      expect {
        post "/api/v1/collections/#{collection.id}/entries",
          params: { entry_type: "View", entry_id: deck.id }, headers: headers, as: :json
      }.not_to change { collection.collection_entries.count }

      expect(response).to have_http_status(:no_content)
    end

    it "rejects an unknown entry_type" do
      collection = user.collections.create!(name: "学習")

      post "/api/v1/collections/#{collection.id}/entries",
        params: { entry_type: "Room", entry_id: SecureRandom.uuid }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "does not add another users object" do
      collection = user.collections.create!(name: "学習")
      other = create(:user, :confirmed)
      other_deck = other.views.create!(name: "他人デッキ", view_type: "deck")

      post "/api/v1/collections/#{collection.id}/entries",
        params: { entry_type: "View", entry_id: other_deck.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "removes an entry" do
      collection = user.collections.create!(name: "学習")
      deck = create_view("単語")
      collection.collection_entries.create!(entry: deck)

      expect {
        delete "/api/v1/collections/#{collection.id}/entries/View/#{deck.id}", headers: headers, as: :json
      }.to change { collection.collection_entries.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "DELETE /api/v1/collections/:id" do
    it "deletes the collection" do
      collection = user.collections.create!(name: "消す")

      expect {
        delete "/api/v1/collections/#{collection.id}", headers: headers, as: :json
      }.to change { user.collections.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
