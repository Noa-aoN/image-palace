require "rails_helper"

RSpec.describe "Api::V1::ItemTypes", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "GET /api/v1/item_types" do
    it "returns 401 without auth headers" do
      get "/api/v1/item_types", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns the list of item types" do
      ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" }
      ItemType.find_or_create_by!(name: "concept") { |it| it.label = "概念" }

      get "/api/v1/item_types", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      names = json_response.fetch("item_types").map { |it| it.fetch("name") }
      expect(names).to include("term", "concept")
      first = json_response["item_types"].first
      expect(first).to include("id", "name", "label")
    end
  end
end
