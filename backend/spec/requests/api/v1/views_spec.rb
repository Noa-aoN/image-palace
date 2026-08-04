require "rails_helper"

RSpec.describe "Api::V1::Views", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "認証ガード" do
    it "GET /api/v1/views returns 401 without auth headers" do
      get "/api/v1/views", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/views" do
    it "returns the user's views" do
      user.views.create!(name: "関係図")
      user.views.create!(name: "タイムライン")

      get "/api/v1/views", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      names = json_response.fetch("views").map { |v| v["name"] }
      expect(names).to contain_exactly("関係図", "タイムライン")
    end

    it "does not return other users views" do
      user.views.create!(name: "自分")
      other = create(:user, :confirmed)
      other.views.create!(name: "他人")

      get "/api/v1/views", headers: headers, as: :json

      names = json_response.fetch("views").map { |v| v["name"] }
      expect(names).to include("自分")
      expect(names).not_to include("他人")
    end
  end

  describe "POST /api/v1/views" do
    it "creates a view with default view_type" do
      expect {
        post "/api/v1/views", params: { view: { name: "新ビュー" } }, headers: headers, as: :json
      }.to change { user.views.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("新ビュー")
      expect(json_response["view_type"]).to eq("freeboard")
    end

    it "creates a view with the given view_type" do
      post "/api/v1/views", params: { view: { name: "年表", view_type: "timeline" } }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["view_type"]).to eq("timeline")
    end

    it "rejects an unknown view_type" do
      post "/api/v1/views", params: { view: { name: "x", view_type: "bogus" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "returns validation error when name is blank" do
      post "/api/v1/views", params: { view: { name: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "GET /api/v1/views/:id" do
    it "returns the view" do
      view = user.views.create!(name: "関係図")

      get "/api/v1/views/#{view.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["name"]).to eq("関係図")
    end

    it "rejects access to another users view" do
      other = create(:user, :confirmed)
      other_view = other.views.create!(name: "他人")

      get "/api/v1/views/#{other_view.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/views/:id" do
    it "updates the view" do
      view = user.views.create!(name: "旧名")

      patch "/api/v1/views/#{view.id}", params: { view: { name: "新名" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(view.reload.name).to eq("新名")
    end
  end

  describe "DELETE /api/v1/views/:id" do
    it "deletes the view" do
      view = user.views.create!(name: "消す")

      expect {
        delete "/api/v1/views/#{view.id}", headers: headers, as: :json
      }.to change { user.views.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "deck 種別" do
    let(:deck_view) { user.views.create!(name: "英単語", view_type: "deck") }
    let(:card_a) { create(:item, user:) }
    let(:card_b) { create(:item, user:) }

    it "creates a deck view" do
      post "/api/v1/views", params: { view: { name: "英単語", view_type: "deck" } }, headers:, as: :json
      expect(response).to have_http_status(:created)
      expect(json_response["view_type"]).to eq("deck")
    end

    it "appends added cards with sequential position" do
      post "/api/v1/views/#{deck_view.id}/items", params: { item_id: card_a.id }, headers:, as: :json
      post "/api/v1/views/#{deck_view.id}/items", params: { item_id: card_b.id }, headers:, as: :json

      positions = deck_view.view_items.order(:position).pluck(:item_id, :position)
      expect(positions).to eq([ [ card_a.id, 1 ], [ card_b.id, 2 ] ])
    end

    it "returns detail items ordered by position" do
      deck_view.view_items.create!(item: card_b, position: 2)
      deck_view.view_items.create!(item: card_a, position: 1)

      get "/api/v1/views/#{deck_view.id}", headers:, as: :json

      expect(json_response["items"].map { |i| i["item_id"] }).to eq([ card_a.id, card_b.id ])
    end

    it "reorders cards by ordered_item_ids" do
      deck_view.view_items.create!(item: card_a, position: 1)
      deck_view.view_items.create!(item: card_b, position: 2)

      patch "/api/v1/views/#{deck_view.id}/reorder",
        params: { ordered_item_ids: [ card_b.id, card_a.id ] }, headers:, as: :json

      expect(response).to have_http_status(:no_content)
      expect(deck_view.view_items.order(:position).pluck(:item_id)).to eq([ card_b.id, card_a.id ])
    end
  end

  describe "freeboard のレイヤー並び替え" do
    let(:board) { user.views.create!(name: "board") } # 既定は freeboard
    let(:card_a) { create(:item, user:) }
    let(:card_b) { create(:item, user:) }

    it "reorders by ordered_item_ids into z_index (先頭=手前=最大)" do
      board.view_items.create!(item: card_a, x: 0, y: 0, z_index: 0)
      board.view_items.create!(item: card_b, x: 0, y: 0, z_index: 0)

      patch "/api/v1/views/#{board.id}/reorder",
        params: { ordered_item_ids: [ card_b.id, card_a.id ] }, headers:, as: :json

      expect(response).to have_http_status(:no_content)
      expect(board.view_items.find_by(item_id: card_b.id).z_index).to eq(2)
      expect(board.view_items.find_by(item_id: card_a.id).z_index).to eq(1)
    end
  end

  describe "ボード設定 (settings)" do
    it "settings を保存し詳細で返す" do
      view = user.views.create!(name: "board")

      patch "/api/v1/views/#{view.id}",
        params: { view: { settings: { bg_color: "#111111", bg_pattern: "grid", minimap: false, controls: true } } },
        headers:, as: :json

      expect(response).to have_http_status(:success)
      view.reload
      expect(view.settings["bg_pattern"]).to eq("grid")
      expect(view.settings["minimap"]).to be(false)

      get "/api/v1/views/#{view.id}", headers:, as: :json
      expect(json_response["settings"]["bg_color"]).to eq("#111111")
    end
  end

  describe "背景画像" do
    let(:view) { user.views.create!(name: "board") }

    it "ファイル未指定は 422" do
      post "/api/v1/views/#{view.id}/background_image", headers:, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "未添付でも DELETE は成功する（background_image は nil）" do
      delete "/api/v1/views/#{view.id}/background_image", headers:, as: :json
      expect(response).to have_http_status(:success)
      expect(json_response["background_image"]).to be_nil
    end
  end

  describe "GET /api/v1/views 件数の指定" do
    before do
      3.times { |i| user.views.create!(name: "v-#{i}", view_type: "freeboard", created_at: Time.current + i.seconds) }
    end

    it "指定した件数だけ返し、続きの位置を添える" do
      get "/api/v1/views", params: { limit: 2 }, headers: headers

      body = response.parsed_body
      expect(body["views"].size).to eq 2
      expect(body["next_cursor"]).to be_present
    end

    it "続きの位置を渡すとその先だけを返す" do
      get "/api/v1/views", params: { limit: 2 }, headers: headers
      cursor = response.parsed_body["next_cursor"]

      get "/api/v1/views", params: { limit: 2, cursor: cursor }, headers: headers

      names = response.parsed_body["views"].map { |v| v["name"] }
      expect(names).not_to include "v-2"
    end

    it "件数を指定しなければ従来どおり全件返す" do
      get "/api/v1/views", headers: headers

      body = response.parsed_body
      expect(body["views"].size).to be >= 3
      expect(body["next_cursor"]).to be_nil
    end
  end

  describe "名前・種別での絞り込み" do
    it "q に当たるものだけ返す" do
      user.views.create!(name: "英単語デッキ", view_type: "deck")
      user.views.create!(name: "関係図", view_type: "freeboard")

      get "/api/v1/views", params: { q: "英単語" }, headers: headers

      expect(json_response["views"].map { |v| v["name"] }).to eq([ "英単語デッキ" ])
    end

    it "種別で絞り込める" do
      user.views.create!(name: "デッキ", view_type: "deck")
      user.views.create!(name: "ボード", view_type: "freeboard")

      get "/api/v1/views", params: { type: "deck" }, headers: headers

      expect(json_response["views"].map { |v| v["view_type"] }).to eq([ "deck" ])
    end

    it "知らない種別は無視する（全件が消えない）" do
      user.views.create!(name: "デッキ", view_type: "deck")

      get "/api/v1/views", params: { type: "とくべつ" }, headers: headers

      expect(json_response["views"].size).to eq(1)
    end

    it "検索の記号をそのまま渡しても全件にならない" do
      user.views.create!(name: "デッキ", view_type: "deck")

      get "/api/v1/views", params: { q: "%" }, headers: headers

      expect(json_response["views"]).to be_empty
    end
  end
end
