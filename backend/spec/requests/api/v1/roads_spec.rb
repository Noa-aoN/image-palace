require "rails_helper"

RSpec.describe "Api::V1::Roads", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:space) { create(:space, user: user) }

  describe "認証ガード" do
    it "GET roads は認証なしで 401" do
      get "/api/v1/spaces/#{space.id}/roads", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "ロードの CRUD" do
    it "作成・一覧・取得できる" do
      post "/api/v1/spaces/#{space.id}/roads", params: { road: { name: "記憶の道" } }, headers: headers
      expect(response).to have_http_status(:created)
      road_id = json_response["id"]

      get "/api/v1/spaces/#{space.id}/roads", headers: headers
      expect(json_response["roads"].map { |r| r["name"] }).to include("記憶の道")

      get "/api/v1/spaces/#{space.id}/roads/#{road_id}", headers: headers
      expect(json_response["points"]).to eq([])
    end

    it "他ユーザーのスペースには作成できない（404）" do
      other_space = create(:space, user: create(:user, :confirmed))
      post "/api/v1/spaces/#{other_space.id}/roads", params: { road: { name: "x" } }, headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "削除できる" do
      road = create(:road, space: space)
      delete "/api/v1/spaces/#{space.id}/roads/#{road.id}", headers: headers
      expect(response).to have_http_status(:no_content)
      expect(space.roads.count).to eq(0)
    end
  end

  describe "ポイント操作" do
    let(:road) { create(:road, space: space) }
    let(:item) { create(:item, user: user, title: "りんご") }

    it "空ポイントを追加すると序数が振られる" do
      post "/api/v1/spaces/#{space.id}/roads/#{road.id}/points", headers: headers
      expect(response).to have_http_status(:created)
      expect(json_response["position"]).to eq(1)
      expect(json_response["item"]).to be_nil

      post "/api/v1/spaces/#{space.id}/roads/#{road.id}/points", headers: headers
      expect(json_response["position"]).to eq(2)
    end

    it "ポイントにカードを割り当て・クリアできる" do
      point = create(:road_point, road: road, position: 1)

      patch "/api/v1/spaces/#{space.id}/roads/#{road.id}/points/#{point.id}",
        params: { item_id: item.id }, headers: headers
      expect(response).to have_http_status(:success)
      expect(json_response["item"]["title"]).to eq("りんご")

      patch "/api/v1/spaces/#{space.id}/roads/#{road.id}/points/#{point.id}",
        params: { item_id: "" }, headers: headers
      expect(json_response["item"]).to be_nil
    end

    it "他ユーザーのカードは割り当てられない（404）" do
      point = create(:road_point, road: road, position: 1)
      other_item = create(:item, user: create(:user, :confirmed))

      patch "/api/v1/spaces/#{space.id}/roads/#{road.id}/points/#{point.id}",
        params: { item_id: other_item.id }, headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "カードを削除するとポイントは残り、空になる" do
      point = create(:road_point, road: road, position: 1, item: item)
      item.destroy!
      expect(point.reload.item_id).to be_nil
    end

    it "ポイントを並び替えできる" do
      p1 = create(:road_point, road: road, position: 1)
      p2 = create(:road_point, road: road, position: 2)

      patch "/api/v1/spaces/#{space.id}/roads/#{road.id}/points/reorder",
        params: { ordered_ids: [ p2.id, p1.id ] }, headers: headers
      expect(response).to have_http_status(:no_content)
      expect(p2.reload.position).to eq(1)
      expect(p1.reload.position).to eq(2)
    end

    it "ポイントを削除できる" do
      point = create(:road_point, road: road, position: 1)
      delete "/api/v1/spaces/#{space.id}/roads/#{road.id}/points/#{point.id}", headers: headers
      expect(response).to have_http_status(:no_content)
      expect(road.road_points.count).to eq(0)
    end
  end
end
