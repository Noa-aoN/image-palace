require "rails_helper"

RSpec.describe "Api::V1::Items meaning", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user, title: "光合成") }

  describe "POST /api/v1/items/:id/meaning" do
    it "認証なしでは 401" do
      post "/api/v1/items/#{item.id}/meaning", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "意味を生成してアイテムを返す" do
      allow(GenerateMeaningService).to receive(:call) do |item:, level: nil|
        item.meanings.create!(
          language_code: "ja", definition: "植物が光で養分を作る働き",
          example_sentence: "例文", detail_level: Meaning.normalize_level(level)
        )
      end

      post "/api/v1/items/#{item.id}/meaning", params: { level: "detailed" }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["meaning"]).to include("光")
      expect(json_response["meaning_example"]).to eq("例文")
      expect(json_response["meaning_level"]).to eq("detailed")
    end

    it "生成に失敗したら 422" do
      allow(GenerateMeaningService).to receive(:call).and_raise(GenerateMeaningService::GenerationError, "失敗")

      post "/api/v1/items/#{item.id}/meaning", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to be_present
    end

    it "他ユーザーのアイテムは 404" do
      other_item = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{other_item.id}/meaning", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
