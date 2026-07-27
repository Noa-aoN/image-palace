require "rails_helper"

RSpec.describe "Api::V1::TagGroups", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "認証ガード" do
    it "GET /api/v1/tag_groups returns 401 without auth headers" do
      get "/api/v1/tag_groups", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/tag_groups" do
    it "ピン留め→position 順でグループと所属タグIDを返す" do
      Tag.assign_defaults_to(user)
      science = user.tag_groups.find_by(default_key: "science")

      get "/api/v1/tag_groups", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      groups = json_response.fetch("tag_groups")
      target = groups.find { |g| g["id"] == science.id }
      expect(target["default_key"]).to eq("science")
      expect(target["is_default"]).to be(true)
      expect(target["tag_ids"]).to be_present
    end

    it "他ユーザーのグループは返さない" do
      user.tag_groups.create!(name: "自分のG")
      other = create(:user, :confirmed)
      other.tag_groups.create!(name: "他人のG")

      get "/api/v1/tag_groups", headers: headers, as: :json

      names = json_response.fetch("tag_groups").map { |g| g["name"] }
      expect(names).to include("自分のG")
      expect(names).not_to include("他人のG")
    end
  end

  describe "POST /api/v1/tag_groups" do
    it "グループを作成する" do
      expect {
        post "/api/v1/tag_groups", params: { tag_group: { name: "語学" } }, headers: headers, as: :json
      }.to change { user.tag_groups.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("語学")
      expect(json_response["tag_ids"]).to eq([])
    end

    it "重複名はバリデーションエラー" do
      user.tag_groups.create!(name: "既存G")

      post "/api/v1/tag_groups", params: { tag_group: { name: "既存G" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end
  end

  describe "PATCH /api/v1/tag_groups/:id" do
    it "改名とピン留めができる（既定グループも）" do
      Tag.assign_defaults_to(user)
      group = user.tag_groups.find_by(default_key: "science")

      patch "/api/v1/tag_groups/#{group.id}",
            params: { tag_group: { name: "自然系", pinned: true } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(group.reload.name).to eq("自然系")
      expect(group.pinned).to be(true)
    end
  end

  describe "DELETE /api/v1/tag_groups/:id" do
    it "既定グループも削除でき、タグ自体は残る" do
      Tag.assign_defaults_to(user)
      group = user.tag_groups.find_by(default_key: "science")

      expect {
        delete "/api/v1/tag_groups/#{group.id}", headers: headers, as: :json
      }.to change { user.tag_groups.count }.by(-1)

      expect(response).to have_http_status(:no_content)
      expect(user.tags.where(name: "自然科学")).to exist
    end

    it "delete_tags=true でメンバータグごと削除する" do
      group = user.tag_groups.create!(name: "消すG")
      a = user.tags.create!(name: "a")
      b = user.tags.create!(name: "b")
      keep = user.tags.create!(name: "残す")
      group.tag_group_items.create!(tag: a)
      group.tag_group_items.create!(tag: b)

      expect {
        delete "/api/v1/tag_groups/#{group.id}?delete_tags=true", headers: headers, as: :json
      }.to change { user.tags.count }.by(-2)

      expect(response).to have_http_status(:no_content)
      expect(user.tags.where(id: [ a.id, b.id ])).to be_empty
      expect(user.tags.where(id: keep.id)).to exist
    end
  end

  describe "メンバーシップ" do
    it "タグの追加・除外ができる" do
      group = user.tag_groups.create!(name: "G")
      tag = user.tags.create!(name: "英語")

      post "/api/v1/tag_groups/#{group.id}/items",
           params: { tag_id: tag.id }, headers: headers, as: :json
      expect(response).to have_http_status(:created)
      expect(json_response["tag_ids"]).to include(tag.id)

      delete "/api/v1/tag_groups/#{group.id}/items/#{tag.id}", headers: headers, as: :json
      expect(response).to have_http_status(:success)
      expect(json_response["tag_ids"]).not_to include(tag.id)
    end

    it "同じタグを複数グループに追加できる（多重所属）" do
      g1 = user.tag_groups.create!(name: "G1")
      g2 = user.tag_groups.create!(name: "G2")
      tag = user.tags.create!(name: "共有")

      post "/api/v1/tag_groups/#{g1.id}/items", params: { tag_id: tag.id }, headers: headers, as: :json
      post "/api/v1/tag_groups/#{g2.id}/items", params: { tag_id: tag.id }, headers: headers, as: :json

      expect(g1.reload.tags).to include(tag)
      expect(g2.reload.tags).to include(tag)
    end

    it "他ユーザーのタグは追加できない" do
      group = user.tag_groups.create!(name: "G")
      other_tag = create(:user, :confirmed).tags.create!(name: "他人タグ")

      post "/api/v1/tag_groups/#{group.id}/items",
           params: { tag_id: other_tag.id }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "並べ替え" do
    it "グループの並び順を更新する" do
      a = user.tag_groups.create!(name: "A", position: 1)
      b = user.tag_groups.create!(name: "B", position: 2)

      patch "/api/v1/tag_groups/reorder", params: { ids: [ b.id, a.id ] }, headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(b.reload.position).to eq(1)
      expect(a.reload.position).to eq(2)
    end

    it "グループ内タグの並び順を更新する" do
      group = user.tag_groups.create!(name: "G")
      t1 = user.tags.create!(name: "t1")
      t2 = user.tags.create!(name: "t2")
      group.tag_group_items.create!(tag: t1, position: 1)
      group.tag_group_items.create!(tag: t2, position: 2)

      patch "/api/v1/tag_groups/#{group.id}/items/reorder",
            params: { tag_ids: [ t2.id, t1.id ] }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["tag_ids"]).to eq([ t2.id, t1.id ])
    end
  end
end
