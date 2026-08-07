require "rails_helper"

RSpec.describe "Api::V1::ItemProperties", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  def define!(key:, value_type: "text", label: "項目")
    user.property_definitions.create!(item_type: item_type, key: key, label: label, value_type: value_type)
  end

  def put_value(definition, value)
    put "/api/v1/items/#{item.id}/properties/#{definition.id}", params: { value: value }, headers: headers
  end

  describe "PUT /api/v1/items/:item_id/properties/:property_definition_id" do
    it "認証なしでは 401" do
      definition = define!(key: "reading")
      put "/api/v1/items/#{item.id}/properties/#{definition.id}", params: { value: "x" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "値を入れる" do
      definition = define!(key: "reading")

      put_value(definition, "こうごうせい")

      expect(response).to have_http_status(:success)
      expect(json_response["value"]).to eq("こうごうせい")
      expect(item.item_properties.count).to eq(1)
    end

    it "同じ項目に入れ直すと上書きする（行は増えない）" do
      definition = define!(key: "reading")

      put_value(definition, "ふるい")
      put_value(definition, "あたらしい")

      expect(item.item_properties.count).to eq(1)
      expect(item.item_properties.first.typed_value).to eq("あたらしい")
    end

    it "空にすると行ごと消す（未設定と区別が付かなくなるため）" do
      definition = define!(key: "reading")
      put_value(definition, "こうごうせい")

      put_value(definition, "")

      expect(response).to have_http_status(:success)
      expect(item.item_properties.count).to eq(0)
    end

    it "list は配列で受け、空要素を落とす" do
      definition = define!(key: "aliases", value_type: "list")

      put_value(definition, [ "炭酸同化", "", "  ", "光合成作用" ])

      expect(json_response["value"]).to eq([ "炭酸同化", "光合成作用" ])
    end

    it "number は数として読めないものを弾く" do
      definition = define!(key: "year", value_type: "number")

      put_value(definition, "12個")

      expect(response).to have_http_status(:success)
      expect(item.item_properties.count).to eq(0)
    end

    it "number は数なら入る" do
      definition = define!(key: "year", value_type: "number")

      put_value(definition, "1779")

      expect(json_response["value"]).to eq(1779.0)
    end

    it "url は http(s) 以外を弾く" do
      definition = define!(key: "source", value_type: "url")

      put_value(definition, "javascript:alert(1)")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(item.item_properties.count).to eq(0)
    end

    it "date は日付として読めないものを弾く" do
      definition = define!(key: "born", value_type: "date")

      put_value(definition, "きのう")

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他ユーザーのカードには入れられない" do
      definition = define!(key: "reading")
      other = create(:item, user: create(:user, :confirmed), item_type: item_type)

      put "/api/v1/items/#{other.id}/properties/#{definition.id}", params: { value: "x" }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "他ユーザーの定義は使えない" do
      foreign = create(:user, :confirmed).property_definitions.create!(
        item_type: item_type, key: "foreign", label: "よそ", value_type: "text"
      )

      put "/api/v1/items/#{item.id}/properties/#{foreign.id}", params: { value: "x" }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "カード詳細の properties" do
    it "その種別の定義を順番どおりに全部返す（未入力も出す）" do
      a = define!(key: "reading", label: "読み仮名")
      define!(key: "aliases", label: "別名", value_type: "list")
      put_value(a, "こうごうせい")

      get "/api/v1/items/#{item.id}", headers: headers

      props = json_response["properties"]
      expect(props.map { |p| p["key"] }).to eq(%w[reading aliases])
      expect(props.first["value"]).to eq("こうごうせい")
      # 未入力でも項目は出す。list は空配列
      expect(props.last["value"]).to eq([])
    end

    it "別の種別の定義は出さない" do
      other_type = ItemType.find_or_create_by!(name: "person") { |t| t.label = "人物" }
      user.property_definitions.create!(item_type: other_type, key: "born", label: "生年", value_type: "date")
      define!(key: "reading", label: "読み仮名")

      get "/api/v1/items/#{item.id}", headers: headers

      expect(json_response["properties"].map { |p| p["key"] }).to eq(%w[reading])
    end
  end
end
