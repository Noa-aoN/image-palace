require "rails_helper"

# 色は**項目の設定でだけ**選ぶ。カード1枚の詳細からは変えられない。
# その種別のカード全部に効く設定なので、1枚の上で変えると
# 「このカードだけ」と誤読される（#849 で同じ問題を扱っている）。
RSpec.describe "項目ごとの色（API）", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def define!(key:, label: "語源", color: nil)
    user.property_definitions.create!(item_type: item_type, key: key, label: label, value_type: "text", color: color)
  end

  describe "設定から色を決める" do
    it "作るときに付けられる" do
      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: item_type.id, key: "origin", label: "語源", color: "purple" } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["color"]).to eq("purple")
    end

    it "あとから変えられる" do
      definition = define!(key: "origin", color: "gold")

      patch "/api/v1/property_definitions/#{definition.id}",
            params: { property_definition: { color: "blue" } },
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["color"]).to eq("blue")
    end

    it "外せる" do
      definition = define!(key: "origin", color: "gold")

      patch "/api/v1/property_definitions/#{definition.id}",
            params: { property_definition: { color: "" } },
            headers: headers

      expect(json_response["color"]).to be_nil
    end

    it "知らない色は断る" do
      definition = define!(key: "origin")

      patch "/api/v1/property_definitions/#{definition.id}",
            params: { property_definition: { color: "たまご色" } },
            headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(definition.reload.color).to be_nil
    end

    it "一覧にも色が出る" do
      define!(key: "origin", color: "green")

      get "/api/v1/property_definitions", params: { item_type_id: item_type.id }, headers: headers

      expect(json_response["property_definitions"].first["color"]).to eq("green")
    end
  end

  # 画面は丸を出すだけでよい。カード詳細が項目一覧を返すので、そこに色が要る
  describe "カード詳細" do
    it "値が入っていない項目にも色が付いて返る" do
      define!(key: "origin", color: "red")
      item = create(:item, user: user, item_type: item_type)

      get "/api/v1/items/#{item.id}", headers: headers

      entry = json_response["properties"].find { |p| p["key"] == "origin" }
      expect(entry["color"]).to eq("red")
      expect(entry["value"]).to be_nil
    end

    it "色を付けていない項目は nil で返る（丸を出さない）" do
      define!(key: "origin")
      item = create(:item, user: user, item_type: item_type)

      get "/api/v1/items/#{item.id}", headers: headers

      expect(json_response["properties"].find { |p| p["key"] == "origin" }["color"]).to be_nil
    end
  end
end
