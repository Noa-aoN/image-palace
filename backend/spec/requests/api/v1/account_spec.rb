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

      get "/api/v1/account/export", headers: headers

      expect(response).to have_http_status(:success)
      expect(response.headers["Content-Disposition"]).to include("attachment")
      expect(response.headers["Content-Disposition"]).to include(".json")
      expect(json_response["user"]["email"]).to eq(user.email)
      expect(json_response["items"].map { |i| i["title"] }).to include("光合成")
      expect(json_response["items"].map { |i| i["id"] }).to include(item.id)
    end

    # 持ち出したいのは、まず自分で書いたもの。項目が抜けていると、
    # **書いた内容の大半が持ち出せていない**ことになる
    context "カードの項目" do
      let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
      let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

      def write!(key, value_type, value)
        definition = user.property_definitions.create!(item_type: item_type, key: key,
                                                       label: key, value_type: value_type)
        property = item.item_properties.create!(property_definition: definition)
        property.typed_value = value
        property.save!
      end

      def exported_properties
        get "/api/v1/account/export", headers: headers
        json_response["items"].find { |i| i["id"] == item.id }["properties"]
      end

      it "書いた項目を、呼び名と型ごと出す" do
        write!("reading", "text", "こうごうせい")

        expect(exported_properties).to include(
          hash_including("key" => "reading", "label" => "reading",
                          "value_type" => "text", "value" => "こうごうせい")
        )
      end

      it "中身が2つある項目は、形のまま出す（読み込み直せる）" do
        write!("note", "free_text", { "heading" => "覚え方", "body" => "葉が光を食べる" })

        expect(exported_properties.first["value"]).to eq("heading" => "覚え方", "body" => "葉が光を食べる")
      end

      it "内部の目印は出さない（持ち出す人には意味が無い）" do
        write!("scene", "free_image", { "heading" => "葉のなか", "prompt" => "葉緑体",
                                         "status" => "completed", "shared_media_id" => 42 })

        expect(exported_properties.first["value"]).not_to have_key("shared_media_id")
        expect(exported_properties.first["value"]["prompt"]).to eq("葉緑体")
      end

      it "触っていない項目は出さない（空の行だけが並ばない）" do
        definition = user.property_definitions.create!(item_type: item_type, key: "memo",
                                                        label: "memo", value_type: "text")
        item.item_properties.create!(property_definition: definition)

        expect(exported_properties).to be_empty
      end

      it "切ってあるチェックは出す（**false は「書いていない」ではない**）" do
        write!("done", "boolean", false)

        expect(exported_properties.first["value"]).to be(false)
      end
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

      expect do
        delete "/api/v1/account", headers: headers
      end.to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
      expect(User.exists?(user.id)).to be(false)
      expect(Item.exists?(item.id)).to be(false)
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
