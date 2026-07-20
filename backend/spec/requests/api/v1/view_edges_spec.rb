require "rails_helper"

RSpec.describe "Api::V1::Views edges (freeboard)", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:view) { create(:view, user: user) }
  let(:item_a) { create(:item, user: user, title: "A") }
  let(:item_b) { create(:item, user: user, title: "B") }

  describe "POST /api/v1/views/:id/edges" do
    it "認証なしでは 401" do
      post "/api/v1/views/#{view.id}/edges",
        params: { source_node_id: item_a.id, target_node_id: item_b.id }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "接続線を作成する" do
      post "/api/v1/views/#{view.id}/edges",
        params: {
          source_node_id: item_a.id, target_node_id: item_b.id,
          source_handle: "right", target_handle: "left", label: "因果"
        }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["source"]).to eq(item_a.id)
      expect(json_response["target"]).to eq(item_b.id)
      expect(json_response["label"]).to eq("因果")
      expect(view.view_edges.count).to eq(1)
    end

    it "source/target が無いと 422" do
      post "/api/v1/views/#{view.id}/edges", params: { source_node_id: item_a.id }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他ユーザーのビューには作れない（404）" do
      other = create(:view, user: create(:user, :confirmed))
      post "/api/v1/views/#{other.id}/edges",
        params: { source_node_id: item_a.id, target_node_id: item_b.id }, headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/views/:id/edges/:edge_id" do
    it "ラベル・スタイル・向き（反転）を更新する" do
      edge = create(:view_edge, view: view, source_node_id: item_a.id, target_node_id: item_b.id)

      patch "/api/v1/views/#{view.id}/edges/#{edge.id}",
        params: {
          label: "順序", style: { color: "#ff0000", dashed: true },
          source_node_id: item_b.id, target_node_id: item_a.id
        }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      edge.reload
      expect(edge.label).to eq("順序")
      expect(edge.style["color"]).to eq("#ff0000")
      expect(edge.style["dashed"]).to be(true)
      expect(edge.source_node_id).to eq(item_b.id)
    end

    it "始端・終端マーカーを保存する" do
      edge = create(:view_edge, view: view, source_node_id: item_a.id, target_node_id: item_b.id)

      patch "/api/v1/views/#{view.id}/edges/#{edge.id}",
        params: { style: { marker_start: "arrow", marker_end: "none" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      edge.reload
      expect(edge.style["marker_start"]).to eq("arrow")
      expect(edge.style["marker_end"]).to eq("none")
    end
  end

  describe "DELETE /api/v1/views/:id/edges/:edge_id" do
    it "接続線を削除する" do
      edge = create(:view_edge, view: view)

      delete "/api/v1/views/#{view.id}/edges/#{edge.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(view.view_edges.count).to eq(0)
    end
  end

  describe "GET /api/v1/views/:id" do
    it "freeboard 詳細に edges を含む" do
      create(:view_edge, view: view, source_node_id: item_a.id, target_node_id: item_b.id, label: "x")

      get "/api/v1/views/#{view.id}", headers: headers

      expect(json_response["edges"].size).to eq(1)
      expect(json_response["edges"].first["source"]).to eq(item_a.id)
    end
  end

  describe "カード削除時の掃除" do
    it "その端点を含む接続線だけ消える" do
      create(:view_item, view: view, item: item_a)
      create(:view_edge, view: view, source_node_id: item_a.id, target_node_id: item_b.id)
      create(:view_edge, view: view, source_node_id: "n:x", target_node_id: "n:y")

      delete "/api/v1/views/#{view.id}/items/#{item_a.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(view.view_edges.count).to eq(1)
    end
  end
end
