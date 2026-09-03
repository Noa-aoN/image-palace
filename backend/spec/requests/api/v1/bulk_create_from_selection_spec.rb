require "rails_helper"

# 選んだカードから作る導線があるので、作ってから1枚ずつ入れると
# 50枚で51往復になる。**往復の本数がそのまま待ち時間になる**ため、
# 作成と同時にカードを受け取れるようにしてある。
RSpec.describe "選んだカードからまとめて作る", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def card(title) = create(:item, user: user, item_type: item_type, title: title)

  describe "キャンバス" do
    it "作ると同時にカードが入る" do
      a = card("あ")
      b = card("い")

      post "/api/v1/views", params: { view: { name: "新しい板", view_type: "deck" }, item_ids: [ a.id, b.id ] },
                            headers: headers

      expect(response).to have_http_status(:created)
      view = user.views.find(json_response["id"])
      expect(view.view_items.count).to eq(2)
    end

    # 選んだ順に意味があることがある（デッキの並びなど）
    it "渡された順に並ぶ" do
      a = card("あ")
      b = card("い")
      c = card("う")

      post "/api/v1/views", params: { view: { name: "順番", view_type: "deck" }, item_ids: [ c.id, a.id, b.id ] },
                            headers: headers

      view = user.views.find(json_response["id"])
      expect(view.view_items.order(:position).pluck(:item_id)).to eq([ c.id, a.id, b.id ])
    end

    # **id を並べて送れる口なので、ここで絞らないと他人のカードを引き込める**
    it "他人のカードは入らない" do
      mine = card("自分の")
      theirs = create(:item, user: create(:user, :confirmed), item_type: item_type, title: "他人の")

      post "/api/v1/views", params: { view: { name: "板", view_type: "deck" }, item_ids: [ mine.id, theirs.id ] },
                            headers: headers

      view = user.views.find(json_response["id"])
      expect(view.view_items.pluck(:item_id)).to eq([ mine.id ])
    end

    it "同じカードを2回渡しても1つだけ入る" do
      a = card("あ")

      post "/api/v1/views", params: { view: { name: "板", view_type: "deck" }, item_ids: [ a.id, a.id ] },
                            headers: headers

      expect(user.views.find(json_response["id"]).view_items.count).to eq(1)
    end

    it "カードを渡さなくても作れる" do
      post "/api/v1/views", params: { view: { name: "空の板", view_type: "deck" } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(user.views.find(json_response["id"]).view_items).to be_empty
    end

    # 空間配置は点を選ばないと置けない。ここでは入れずに作るだけ
    it "スペース配置には入れない" do
      space = create(:space, user: user)
      a = card("あ")

      post "/api/v1/views",
           params: { view: { name: "配置", view_type: "space_map", space_id: space.id }, item_ids: [ a.id ] },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(user.views.find(json_response["id"]).view_items).to be_empty
    end
  end

  describe "ボックス" do
    it "作ると同時にカードが入る" do
      a = card("あ")
      b = card("い")

      post "/api/v1/boxes", params: { box: { name: "新しい箱" }, item_ids: [ a.id, b.id ] }, headers: headers

      expect(response).to have_http_status(:created)
      expect(user.boxes.find(json_response["id"]).box_entries.count).to eq(2)
    end

    it "他人のカードは入らない" do
      theirs = create(:item, user: create(:user, :confirmed), item_type: item_type, title: "他人の")

      post "/api/v1/boxes", params: { box: { name: "箱" }, item_ids: [ theirs.id ] }, headers: headers

      expect(user.boxes.find(json_response["id"]).box_entries).to be_empty
    end
  end
  # 集めたカードの行き先は、たいてい既にある。
  # 作る道しか無いと「デッキ2」「デッキ3」が増えていくので、足す道も同じ規則で通す。
  describe "いまあるものへ足す" do
    it "キャンバスへまとめて足せる" do
      view = create(:view, user: user, view_type: "deck", name: "既存のデッキ")
      a = card("あ")
      b = card("い")

      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ a.id, b.id ] }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["added"]).to eq(2)
      expect(view.view_items.count).to eq(2)
    end

    it "既に入っているカードは二重にならない" do
      view = create(:view, user: user, view_type: "deck", name: "既存のデッキ")
      a = card("あ")
      b = card("い")
      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ a.id ] }, headers: headers

      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ a.id, b.id ] }, headers: headers

      expect(json_response["added"]).to eq(1)
      expect(view.view_items.count).to eq(2)
    end

    it "並びは末尾へ継ぐ（先にあったカードと番号がぶつからない）" do
      view = create(:view, user: user, view_type: "deck", name: "既存のデッキ")
      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ card("あ").id ] }, headers: headers

      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ card("い").id ] }, headers: headers

      expect(view.view_items.order(:position).pluck(:position)).to eq([ 1, 2 ])
    end

    it "他人のカードは足せない" do
      view = create(:view, user: user, view_type: "deck", name: "既存のデッキ")
      theirs = create(:item, user: create(:user, :confirmed), item_type: item_type, title: "他人の")

      post "/api/v1/views/#{view.id}/items", params: { item_ids: [ theirs.id ] }, headers: headers

      expect(json_response["added"]).to eq(0)
      expect(view.view_items).to be_empty
    end

    it "ボックスへまとめて足せる" do
      box = user.boxes.create!(name: "既存の箱")
      a = card("あ")
      b = card("い")

      post "/api/v1/boxes/#{box.id}/entries", params: { item_ids: [ a.id, b.id ] }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["added"]).to eq(2)
      expect(box.box_entries.count).to eq(2)
    end

    it "ボックスも二重にならない" do
      box = user.boxes.create!(name: "既存の箱")
      a = card("あ")
      post "/api/v1/boxes/#{box.id}/entries", params: { item_ids: [ a.id ] }, headers: headers

      post "/api/v1/boxes/#{box.id}/entries", params: { item_ids: [ a.id ] }, headers: headers

      expect(json_response["added"]).to eq(0)
      expect(box.box_entries.count).to eq(1)
    end
  end
end
