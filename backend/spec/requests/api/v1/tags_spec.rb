require "rails_helper"

RSpec.describe "Api::V1::Tags", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def create_item(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  describe "認証ガード" do
    it "GET /api/v1/tags returns 401 without auth headers" do
      get "/api/v1/tags", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/tags" do
    it "returns the user's tags with item counts" do
      tag = user.tags.create!(name: "英語")
      create_item("apple").tags << tag
      user.tags.create!(name: "未使用")

      get "/api/v1/tags", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      tags = json_response.fetch("tags")
      target = tags.find { |t| t["name"] == "英語" }
      expect(target["item_count"]).to eq(1)
      expect(tags.map { |t| t["name"] }).to include("英語", "未使用")
    end

    it "does not return other users tags" do
      user.tags.create!(name: "自分")
      other = create(:user, :confirmed)
      other.tags.create!(name: "他人")

      get "/api/v1/tags", headers: headers, as: :json

      names = json_response.fetch("tags").map { |t| t["name"] }
      expect(names).to include("自分")
      expect(names).not_to include("他人")
    end
  end

  describe "PATCH /api/v1/tags/:id" do
    it "renames a tag" do
      tag = user.tags.create!(name: "旧名")

      patch "/api/v1/tags/#{tag.id}", params: { tag: { name: "新名" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(tag.reload.name).to eq("新名")
    end
  end

  describe "DELETE /api/v1/tags/:id" do
    it "deletes a tag and detaches it from items" do
      tag = user.tags.create!(name: "消す")
      item = create_item("apple")
      item.tags << tag

      expect {
        delete "/api/v1/tags/#{tag.id}", headers: headers, as: :json
      }.to change { user.tags.count }.by(-1)

      expect(response).to have_http_status(:no_content)
      expect(item.reload.tags).to be_empty
    end
  end
end
