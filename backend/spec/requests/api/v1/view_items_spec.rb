require "rails_helper"

RSpec.describe "Api::V1::Views items (freeboard)", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:view) { create(:view, user: user) }
  let(:item) { create(:item, user: user, title: "cat") }

  describe "POST /api/v1/views/:id/items" do
    it "認証なしでは 401" do
      post "/api/v1/views/#{view.id}/items", params: { item_id: item.id }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "カードを座標付きで配置する" do
      post "/api/v1/views/#{view.id}/items",
        params: { item_id: item.id, x: 120.5, y: 80.0 }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["item_id"]).to eq(item.id)
      expect(json_response["x"]).to eq(120.5)
      expect(json_response["item"]["title"]).to eq("cat")
      expect(view.view_items.count).to eq(1)
    end

    it "他ユーザーのアイテムは配置できない（404）" do
      other_item = create(:item, user: create(:user, :confirmed))
      post "/api/v1/views/#{view.id}/items", params: { item_id: other_item.id }, headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "他ユーザーのビューには配置できない（404）" do
      other_view = create(:view, user: create(:user, :confirmed))
      post "/api/v1/views/#{other_view.id}/items", params: { item_id: item.id }, headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/views/:id/items/:item_id" do
    it "配置を更新する" do
      create(:view_item, view: view, item: item, x: 0, y: 0)

      patch "/api/v1/views/#{view.id}/items/#{item.id}",
        params: { x: 300, y: 200, z_index: 5 }, headers: headers

      expect(response).to have_http_status(:no_content)
      vi = view.view_items.find_by(item_id: item.id)
      expect(vi.x).to eq(300)
      expect(vi.z_index).to eq(5)
    end
  end

  describe "DELETE /api/v1/views/:id/items/:item_id" do
    it "カードを外す" do
      create(:view_item, view: view, item: item)

      delete "/api/v1/views/#{view.id}/items/#{item.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(view.view_items.count).to eq(0)
    end
  end

  describe "GET /api/v1/views/:id" do
    it "配置一覧を返す" do
      create(:view_item, view: view, item: item, x: 10, y: 20)

      get "/api/v1/views/#{view.id}", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["items"].size).to eq(1)
      placement = json_response["items"].first
      expect(placement["item_id"]).to eq(item.id)
      expect(placement["x"]).to eq(10)
      expect(placement["item"]["title"]).to eq("cat")
    end
  end
end
