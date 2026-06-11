require "rails_helper"

RSpec.describe "Api::V1::Collections", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  def create_deck(name)
    user.decks.create!(name: name)
  end

  describe "認証ガード" do
    it "GET /api/v1/collections returns 401 without auth headers" do
      get "/api/v1/collections", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/collections" do
    it "returns the user's collections with deck counts" do
      collection = user.collections.create!(name: "英語")
      collection.decks << create_deck("単語")
      collection.decks << create_deck("文法")
      user.collections.create!(name: "空コレクション")

      get "/api/v1/collections", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      collections = json_response.fetch("collections")
      names = collections.map { |c| c["name"] }
      expect(names).to include("英語", "空コレクション")
      target = collections.find { |c| c["name"] == "英語" }
      expect(target["deck_count"]).to eq(2)
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
        post "/api/v1/collections", params: { collection: { name: "新コレクション", description: "説明" } },
          headers: headers, as: :json
      }.to change { user.collections.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("新コレクション")
      expect(json_response["deck_count"]).to eq(0)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/collections", params: { collection: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/collections/:id" do
    it "returns the collection with its decks" do
      collection = user.collections.create!(name: "英語")
      collection.decks << create_deck("単語")

      get "/api/v1/collections/#{collection.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["decks"].map { |d| d["name"] }).to eq([ "単語" ])
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

  describe "コレクションへのデッキ追加・削除" do
    it "adds a deck to the collection" do
      collection = user.collections.create!(name: "コレクション")
      deck = create_deck("単語")

      expect {
        post "/api/v1/collections/#{collection.id}/decks", params: { deck_id: deck.id },
          headers: headers, as: :json
      }.to change { collection.collection_decks.count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "is idempotent when adding the same deck twice" do
      collection = user.collections.create!(name: "コレクション")
      deck = create_deck("単語")
      collection.decks << deck

      expect {
        post "/api/v1/collections/#{collection.id}/decks", params: { deck_id: deck.id },
          headers: headers, as: :json
      }.not_to change { collection.collection_decks.count }

      expect(response).to have_http_status(:no_content)
    end

    it "does not add another users deck" do
      collection = user.collections.create!(name: "コレクション")
      other = create(:user, :confirmed)
      other_deck = other.decks.create!(name: "他人")

      post "/api/v1/collections/#{collection.id}/decks", params: { deck_id: other_deck.id },
        headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "removes a deck from the collection" do
      collection = user.collections.create!(name: "コレクション")
      deck = create_deck("単語")
      collection.decks << deck

      expect {
        delete "/api/v1/collections/#{collection.id}/decks/#{deck.id}", headers: headers, as: :json
      }.to change { collection.collection_decks.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
