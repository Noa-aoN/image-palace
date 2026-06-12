require "rails_helper"

RSpec.describe "Api::V1::Account", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "GET /api/v1/account/export" do
    it "認証なしでは 401 を返す" do
      get "/api/v1/account/export", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "自分のデータを JSON で返し、ダウンロード用ヘッダを付与する" do
      item = create(:item, user: user, title: "光合成")
      create(:deck, user: user, name: "生物デッキ")

      get "/api/v1/account/export", headers: headers

      expect(response).to have_http_status(:success)
      expect(response.headers["Content-Disposition"]).to include("attachment")
      expect(response.headers["Content-Disposition"]).to include(".json")
      expect(json_response["user"]["email"]).to eq(user.email)
      expect(json_response["items"].map { |i| i["title"] }).to include("光合成")
      expect(json_response["items"].map { |i| i["id"] }).to include(item.id)
      expect(json_response["decks"].map { |d| d["name"] }).to include("生物デッキ")
    end

    it "他ユーザーのデータは含めない" do
      other = create(:user, :confirmed)
      create(:item, user: other, title: "他人のカード")

      get "/api/v1/account/export", headers: headers

      expect(json_response["items"].map { |i| i["title"] }).not_to include("他人のカード")
    end
  end

  describe "DELETE /api/v1/account" do
    it "認証なしでは 401 を返す" do
      delete "/api/v1/account", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "アカウントと関連データを完全削除する" do
      item = create(:item, user: user)
      create(:deck, user: user)

      expect do
        delete "/api/v1/account", headers: headers
      end.to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
      expect(User.exists?(user.id)).to be(false)
      expect(Item.exists?(item.id)).to be(false)
      expect(user.decks.count).to eq(0)
    end

    it "他ユーザーのデータは削除しない" do
      other = create(:user, :confirmed)
      other_item = create(:item, user: other)

      delete "/api/v1/account", headers: headers

      expect(User.exists?(other.id)).to be(true)
      expect(Item.exists?(other_item.id)).to be(true)
    end
  end
end
