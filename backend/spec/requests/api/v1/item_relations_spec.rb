require "rails_helper"

# 関連カード。カード同士のつながりを足したり外したりする。
# 向きを持たない扱いなので、どちら側から見ても同じものが出ることを固定する。
RSpec.describe "関連カード", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user, title: "光合成") }
  let(:other) { create(:item, user: user, title: "葉緑体") }

  describe "POST /api/v1/items/:item_id/relations" do
    it "関連づけられる" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["relations"].map { |r| r["id"] }).to eq([ other.id ])
    end

    # 向きを意識させると、同じつながりを2本作る人が出る
    it "反対側から見ても同じものが出る" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json

      get "/api/v1/items/#{other.id}/relations", headers: headers

      expect(response.parsed_body["relations"].map { |r| r["id"] }).to eq([ item.id ])
    end

    it "反対向きを足しても2本にはしない" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json
      post "/api/v1/items/#{other.id}/relations", params: { to_item_id: item.id }, headers: headers, as: :json

      expect(Relation.count).to eq(1)
      expect(response.parsed_body["relations"].map { |r| r["id"] }).to eq([ item.id ])
    end

    it "同じ相手を2回足しても増えない" do
      2.times do
        post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json
      end

      expect(Relation.count).to eq(1)
    end

    it "自分自身は関連づけられない" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: item.id }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Relation.count).to eq(0)
    end

    it "他人のカードは関連づけられない" do
      foreign = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: foreign.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/items/:item_id/relations/:id" do
    it "どちら側から外しても消える" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json

      delete "/api/v1/items/#{other.id}/relations/#{item.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Relation.count).to eq(0)
    end
  end

  describe "GET /api/v1/items/:item_id/relations" do
    it "ミニカードに要るものを返す" do
      post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json

      get "/api/v1/items/#{item.id}/relations", headers: headers

      row = response.parsed_body["relations"].first
      expect(row).to include("id", "title", "generation_status", "media")
      expect(row["title"]).to eq("葉緑体")
    end

    it "認証が要る" do
      get "/api/v1/items/#{item.id}/relations"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  # カードを消したら、そのカードとのつながりも消える（残ると開けない相手が並ぶ）
  it "カードを消すと関連も消える" do
    post "/api/v1/items/#{item.id}/relations", params: { to_item_id: other.id }, headers: headers, as: :json

    expect { other.destroy! }.to change(Relation, :count).by(-1)
  end
end
