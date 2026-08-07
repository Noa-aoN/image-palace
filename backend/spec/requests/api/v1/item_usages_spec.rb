require "rails_helper"

RSpec.describe "Api::V1::Items usages", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "光合成") }

  describe "GET /api/v1/items/:id/usages" do
    it "認証なしでは 401" do
      get "/api/v1/items/#{item.id}/usages", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "どこにも置かれていなければ空で返る" do
      get "/api/v1/items/#{item.id}/usages", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["views"]).to eq([])
      expect(json_response["spaces"]).to eq([])
      expect(json_response["boxes"]).to eq([])
    end

    it "置かれているキャンバス・スペース・ボックスを引く" do
      view = user.views.create!(name: "英単語ボード", view_type: "freeboard")
      view.view_items.create!(item: item)
      box = user.boxes.create!(name: "英単語帳")
      box.box_items.create!(item: item)
      space = user.spaces.create!(name: "書斎")
      space.space_points.create!(position: 0, name: "点1", item: item)

      get "/api/v1/items/#{item.id}/usages", headers: headers

      expect(json_response["views"].map { |v| v["name"] }).to eq([ "英単語ボード" ])
      expect(json_response["boxes"].map { |b| b["name"] }).to eq([ "英単語帳" ])
      expect(json_response["spaces"].map { |s| s["name"] }).to eq([ "書斎" ])
    end

    it "複数のキャンバスに置かれていれば全部返る" do
      %w[ボードA ボードB].each do |name|
        user.views.create!(name: name, view_type: "freeboard").view_items.create!(item: item)
      end

      get "/api/v1/items/#{item.id}/usages", headers: headers

      expect(json_response["views"].map { |v| v["name"] }).to contain_exactly("ボードA", "ボードB")
    end

    it "同じスペースに複数の点として置かれていても、スペースは1件にまとめる" do
      space = user.spaces.create!(name: "書斎")
      2.times { |i| space.space_points.create!(position: i, name: "点#{i}", item: item) }

      get "/api/v1/items/#{item.id}/usages", headers: headers

      expect(json_response["spaces"].size).to eq(1)
    end

    it "他ユーザーのカードは 404" do
      other = create(:item, user: create(:user, :confirmed))

      get "/api/v1/items/#{other.id}/usages", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
