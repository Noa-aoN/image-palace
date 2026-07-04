require "rails_helper"

RSpec.describe "Api::V1::Search", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe "認証ガード" do
    it "GET /api/v1/search returns 401 without auth headers" do
      get "/api/v1/search", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/search" do
    it "returns matching results across cards/decks/boxes/spaces/views" do
      user.items.create!(title: "英語ノート", item_type: item_type, generation_status: "completed")
      user.views.create!(name: "英語デッキ", view_type: "deck")
      user.boxes.create!(name: "英語コレクション")
      user.spaces.create!(name: "英語スペース")
      user.views.create!(name: "英語ビュー")
      # 非該当
      user.items.create!(title: "数学", item_type: item_type, generation_status: "completed")

      get "/api/v1/search", params: { q: "英語" }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["items"].map { |i| i["title"] }).to eq([ "英語ノート" ])
      expect(json_response["decks"].map { |d| d["name"] }).to eq([ "英語デッキ" ])
      expect(json_response["boxes"].map { |c| c["name"] }).to eq([ "英語コレクション" ])
      expect(json_response["spaces"].map { |s| s["name"] }).to eq([ "英語スペース" ])
      expect(json_response["views"].map { |v| v["name"] }).to eq([ "英語ビュー" ])
    end

    it "returns empty groups for a blank query" do
      user.items.create!(title: "apple", item_type: item_type, generation_status: "completed")

      get "/api/v1/search", params: { q: "" }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response.values_at("items", "decks", "boxes", "spaces", "views")).to all(eq([]))
    end

    it "does not return other users objects" do
      other = create(:user, :confirmed)
      other.views.create!(name: "他人デッキ", view_type: "deck")

      get "/api/v1/search", params: { q: "他人" }, headers: headers

      expect(json_response["decks"]).to be_empty
    end
  end
end
