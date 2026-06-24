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
end
