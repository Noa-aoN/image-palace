require "rails_helper"

RSpec.describe "Api::V1::Views space mapping", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
  let(:space) { create(:space, :road, user: user) }
  let!(:point) { create(:space_point, space: space, position: 1, name: "玄関") }

  describe "POST /api/v1/views（space_map 作成）" do
    it "スペースを指定して space_map ビューを作成できる" do
      post "/api/v1/views",
        params: { view: { name: "記憶の宮殿", view_type: "space_map", space_id: space.id } },
        headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["view_type"]).to eq("space_map")
      expect(json_response["space_id"]).to eq(space.id)
    end

    it "space_id が無いと作成できない" do
      post "/api/v1/views",
        params: { view: { name: "x", view_type: "space_map" } },
        headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他ユーザーのスペースは指定できない" do
      others = create(:space, :road, user: create(:user, :confirmed))

      post "/api/v1/views",
        params: { view: { name: "x", view_type: "space_map", space_id: others.id } },
        headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/v1/views/:id（space_map 詳細）" do
    it "スペースのポイント一覧を返す（配置は初期 null）" do
      view = create(:view, user: user, view_type: "space_map", space: space)

      get "/api/v1/views/#{view.id}", headers: headers, as: :json

      expect(json_response["space"]["id"]).to eq(space.id)
      expect(json_response["points"].first["space_point_id"]).to eq(point.id)
      expect(json_response["points"].first["name"]).to eq("玄関")
      expect(json_response["points"].first["placed_item"]).to be_nil
    end
  end

  describe "POST /api/v1/views/:id/points/:space_point_id（配置）" do
    let(:view) { create(:view, user: user, view_type: "space_map", space: space) }
    let(:item) { create(:item, user: user, item_type: item_type, title: "りんご") }

    it "ポイントにカードを配置できる" do
      post "/api/v1/views/#{view.id}/points/#{point.id}",
        params: { item_id: item.id }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["placed_item"]["title"]).to eq("りんご")

      get "/api/v1/views/#{view.id}", headers: headers, as: :json
      expect(json_response["points"].first["placed_item"]["title"]).to eq("りんご")
    end

    it "同じカードを別ポイントに置くと移動する（ビュー内でカードは一意）" do
      point2 = create(:space_point, space: space, position: 2, name: "台所")
      post "/api/v1/views/#{view.id}/points/#{point.id}",
        params: { item_id: item.id }, headers: headers, as: :json
      post "/api/v1/views/#{view.id}/points/#{point2.id}",
        params: { item_id: item.id }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(view.view_items.where(item_id: item.id).count).to eq(1)
      expect(view.view_items.find_by(item_id: item.id).space_point_id).to eq(point2.id)
    end

    it "ビューのスペースに属さないポイントには配置できない（404）" do
      foreign_point = create(:space_point, space: create(:space, :road, user: user), position: 1)

      post "/api/v1/views/#{view.id}/points/#{foreign_point.id}",
        params: { item_id: item.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/views/:id/points/:space_point_id（配置クリア）" do
    it "ポイントの配置を外せる" do
      view = create(:view, user: user, view_type: "space_map", space: space)
      item = create(:item, user: user, item_type: item_type, title: "りんご")
      view.view_items.create!(space_point_id: point.id, item: item)

      delete "/api/v1/views/#{view.id}/points/#{point.id}", headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(view.view_items.where(space_point_id: point.id)).to be_empty
    end
  end
end
