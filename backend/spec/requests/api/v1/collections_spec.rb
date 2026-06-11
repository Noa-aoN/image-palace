require "rails_helper"

RSpec.describe "Api::V1::Collections", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def create_item(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  describe "認証ガード" do
    it "GET /api/v1/collections returns 401 without auth headers" do
      get "/api/v1/collections", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/collections" do
    it "returns the user's collections with item counts" do
      collection = user.collections.create!(name: "英単語")
      collection.items << create_item("apple")
      collection.items << create_item("banana")
      user.collections.create!(name: "空のデッキ")

      get "/api/v1/collections", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      collections = json_response.fetch("collections")
      names = collections.map { |c| c["name"] }
      expect(names).to include("英単語", "空のデッキ")
      target = collections.find { |c| c["name"] == "英単語" }
      expect(target["item_count"]).to eq(2)
    end

    it "does not return other users collections" do
      user.collections.create!(name: "自分のデッキ")
      other = create(:user, :confirmed)
      other.collections.create!(name: "他人のデッキ")

      get "/api/v1/collections", headers: headers, as: :json

      names = json_response.fetch("collections").map { |c| c["name"] }
      expect(names).to include("自分のデッキ")
      expect(names).not_to include("他人のデッキ")
    end
  end

  describe "POST /api/v1/collections" do
    it "creates a collection" do
      expect {
        post "/api/v1/collections", params: { collection: { name: "新デッキ", description: "説明" } },
          headers: headers, as: :json
      }.to change { user.collections.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("新デッキ")
      expect(json_response["description"]).to eq("説明")
      expect(json_response["item_count"]).to eq(0)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/collections", params: { collection: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/collections/:id" do
    it "returns the collection with its items" do
      collection = user.collections.create!(name: "英単語")
      collection.items << create_item("apple")

      get "/api/v1/collections/#{collection.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["name"]).to eq("英単語")
      expect(json_response["items"].map { |i| i["title"] }).to eq([ "apple" ])
    end

    it "rejects access to another users collection" do
      other = create(:user, :confirmed)
      other_collection = other.collections.create!(name: "他人")

      get "/api/v1/collections/#{other_collection.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/collections/:id" do
    it "updates the collection" do
      collection = user.collections.create!(name: "旧名")

      patch "/api/v1/collections/#{collection.id}", params: { collection: { name: "新名" } },
        headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(collection.reload.name).to eq("新名")
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

  describe "コレクションへのアイテム追加・削除" do
    it "adds an item to the collection" do
      collection = user.collections.create!(name: "デッキ")
      item = create_item("apple")

      expect {
        post "/api/v1/collections/#{collection.id}/items", params: { item_id: item.id },
          headers: headers, as: :json
      }.to change { collection.collection_items.count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "is idempotent when adding the same item twice" do
      collection = user.collections.create!(name: "デッキ")
      item = create_item("apple")
      collection.items << item

      expect {
        post "/api/v1/collections/#{collection.id}/items", params: { item_id: item.id },
          headers: headers, as: :json
      }.not_to change { collection.collection_items.count }

      expect(response).to have_http_status(:no_content)
    end

    it "does not add another users item" do
      collection = user.collections.create!(name: "デッキ")
      other = create(:user, :confirmed)
      other_item = other.items.create!(title: "他人", item_type: item_type, generation_status: "completed")

      post "/api/v1/collections/#{collection.id}/items", params: { item_id: other_item.id },
        headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "removes an item from the collection" do
      collection = user.collections.create!(name: "デッキ")
      item = create_item("apple")
      collection.items << item

      expect {
        delete "/api/v1/collections/#{collection.id}/items/#{item.id}", headers: headers, as: :json
      }.to change { collection.collection_items.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
