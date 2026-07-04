require "rails_helper"

RSpec.describe "Api::V1::Spaces children", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe "room 種別: コレクション" do
    let(:space) { create(:space, user: user, space_type: "room") }
    let(:box) { user.boxes.create!(name: "英単語") }

    # 詳細表示はポイントベースに統一したが、コレクション棚の追加・削除 API は温存している。
    it "コレクションを追加・削除できる" do
      post "/api/v1/spaces/#{space.id}/boxes", params: { box_id: box.id }, headers: headers
      expect(response).to have_http_status(:no_content)
      expect(space.boxes.reload.map(&:name)).to eq([ "英単語" ])

      delete "/api/v1/spaces/#{space.id}/boxes/#{box.id}", headers: headers
      expect(response).to have_http_status(:no_content)
      expect(space.boxes.reload.count).to eq(0)
    end

    it "他ユーザーのコレクションは追加できない（404）" do
      other_box = create(:user, :confirmed).boxes.create!(name: "他人")
      post "/api/v1/spaces/#{space.id}/boxes", params: { box_id: other_box.id }, headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "room の詳細はポイントを返す（ポイントベースに統一）" do
      create(:space_point, space: space, position: 1, name: "玄関")

      get "/api/v1/spaces/#{space.id}", headers: headers

      expect(json_response["points"].map { |p| p["name"] }).to eq([ "玄関" ])
    end
  end

  describe "road 種別: ポイント" do
    let(:space) { create(:space, user: user, space_type: "road") }
    let(:item) { create(:item, user: user, item_type: item_type, title: "りんご") }

    it "空ポイントを追加すると序数が振られる" do
      post "/api/v1/spaces/#{space.id}/points", headers: headers
      expect(response).to have_http_status(:created)
      expect(json_response["position"]).to eq(1)
      expect(json_response["item"]).to be_nil

      post "/api/v1/spaces/#{space.id}/points", headers: headers
      expect(json_response["position"]).to eq(2)
    end

    it "ポイントにカードを割当・クリアできる" do
      point = create(:space_point, space: space, position: 1)

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}", params: { item_id: item.id }, headers: headers
      expect(json_response["item"]["title"]).to eq("りんご")

      patch "/api/v1/spaces/#{space.id}/points/#{point.id}", params: { item_id: "" }, headers: headers
      expect(json_response["item"]).to be_nil
    end

    it "カードを削除するとポイントは残り空になる" do
      point = create(:space_point, space: space, position: 1, item: item)
      item.destroy!
      expect(point.reload.item_id).to be_nil
    end

    it "ポイントを並び替えできる" do
      p1 = create(:space_point, space: space, position: 1)
      p2 = create(:space_point, space: space, position: 2)

      patch "/api/v1/spaces/#{space.id}/points/reorder", params: { ordered_ids: [ p2.id, p1.id ] }, headers: headers
      expect(response).to have_http_status(:no_content)
      expect(p2.reload.position).to eq(1)
      expect(p1.reload.position).to eq(2)
    end

    it "GET でポイント一覧を返す" do
      create(:space_point, space: space, position: 1, item: item)
      get "/api/v1/spaces/#{space.id}", headers: headers
      expect(json_response["points"].first["item"]["title"]).to eq("りんご")
    end
  end
end
