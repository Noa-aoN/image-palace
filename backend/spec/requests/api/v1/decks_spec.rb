require "rails_helper"

RSpec.describe "Api::V1::Decks", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def create_item(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  describe "認証ガード" do
    it "GET /api/v1/decks returns 401 without auth headers" do
      get "/api/v1/decks", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/decks" do
    it "returns the user's decks with item counts" do
      deck = user.decks.create!(name: "英単語")
      deck.items << create_item("apple")
      user.decks.create!(name: "空デッキ")

      get "/api/v1/decks", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      decks = json_response.fetch("decks")
      target = decks.find { |d| d["name"] == "英単語" }
      expect(target["item_count"]).to eq(1)
    end

    it "does not return other users decks" do
      user.decks.create!(name: "自分")
      other = create(:user, :confirmed)
      other.decks.create!(name: "他人")

      get "/api/v1/decks", headers: headers, as: :json

      names = json_response.fetch("decks").map { |d| d["name"] }
      expect(names).to include("自分")
      expect(names).not_to include("他人")
    end
  end

  describe "POST /api/v1/decks" do
    it "creates a deck" do
      expect {
        post "/api/v1/decks", params: { deck: { name: "新デッキ" } }, headers: headers, as: :json
      }.to change { user.decks.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("新デッキ")
      expect(json_response["item_count"]).to eq(0)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/decks", params: { deck: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/decks/:id" do
    it "returns the deck with its cards" do
      deck = user.decks.create!(name: "英単語")
      deck.items << create_item("apple")

      get "/api/v1/decks/#{deck.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["items"].map { |i| i["title"] }).to eq([ "apple" ])
    end

    it "rejects access to another users deck" do
      other = create(:user, :confirmed)
      other_deck = other.decks.create!(name: "他人")

      get "/api/v1/decks/#{other_deck.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "カードの追加・削除" do
    it "adds a card to the deck" do
      deck = user.decks.create!(name: "デッキ")
      item = create_item("apple")

      expect {
        post "/api/v1/decks/#{deck.id}/items", params: { item_id: item.id }, headers: headers, as: :json
      }.to change { deck.deck_items.count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "does not add another users card" do
      deck = user.decks.create!(name: "デッキ")
      other = create(:user, :confirmed)
      other_item = other.items.create!(title: "他人", item_type: item_type, generation_status: "completed")

      post "/api/v1/decks/#{deck.id}/items", params: { item_id: other_item.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "removes a card from the deck" do
      deck = user.decks.create!(name: "デッキ")
      item = create_item("apple")
      deck.items << item

      expect {
        delete "/api/v1/decks/#{deck.id}/items/#{item.id}", headers: headers, as: :json
      }.to change { deck.deck_items.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "表紙（cover）の設定" do
    it "sets a card in the deck as cover" do
      deck = user.decks.create!(name: "デッキ")
      item = create_item("apple")
      deck.items << item

      patch "/api/v1/decks/#{deck.id}", params: { deck: { cover_item_id: item.id } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(deck.reload.cover_item_id).to eq(item.id)
      expect(json_response["cover_item_id"]).to eq(item.id)
    end

    it "rejects a cover that is not in the deck" do
      deck = user.decks.create!(name: "デッキ")
      outside = create_item("outside")

      patch "/api/v1/decks/#{deck.id}", params: { deck: { cover_item_id: outside.id } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(deck.reload.cover_item_id).to be_nil
    end

    it "clears the cover when the cover card is removed" do
      deck = user.decks.create!(name: "デッキ")
      item = create_item("apple")
      deck.items << item
      deck.update!(cover_item_id: item.id)

      delete "/api/v1/decks/#{deck.id}/items/#{item.id}", headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(deck.reload.cover_item_id).to be_nil
    end
  end

  describe "DELETE /api/v1/decks/:id" do
    it "deletes the deck" do
      deck = user.decks.create!(name: "消す")

      expect {
        delete "/api/v1/decks/#{deck.id}", headers: headers, as: :json
      }.to change { user.decks.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
