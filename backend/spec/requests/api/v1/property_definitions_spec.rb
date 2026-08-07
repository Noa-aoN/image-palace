require "rails_helper"

RSpec.describe "Api::V1::PropertyDefinitions", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def define!(key:, label: "項目", value_type: "text", owner: user, type: nil)
    owner.property_definitions.create!(
      item_type: type || item_type, key: key, label: label, value_type: value_type
    )
  end

  describe "POST /api/v1/property_definitions" do
    it "認証なしでは 401" do
      post "/api/v1/property_definitions", params: { property_definition: { key: "reading" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "項目を定義する" do
      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: item_type.id, key: "reading", label: "読み仮名" } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["key"]).to eq("reading")
      expect(json_response["value_type"]).to eq("text")
    end

    it "足すたびに末尾へ並ぶ" do
      define!(key: "a")
      define!(key: "b")
      expect(user.property_definitions.ordered.map(&:key)).to eq(%w[a b])
    end

    it "同じ種別に同じ key は作れない" do
      define!(key: "reading")

      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: item_type.id, key: "reading", label: "重複" } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "種別が違えば同じ key を使える" do
      other_type = ItemType.find_or_create_by!(name: "person") { |t| t.label = "人物" }
      define!(key: "reading")

      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: other_type.id, key: "reading", label: "読み仮名" } },
           headers: headers

      expect(response).to have_http_status(:created)
    end

    it "知らない型は 422" do
      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: item_type.id, key: "x", label: "x", value_type: "bogus" } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "key の形が不正なら 422（機械が使う名前なので絞る）" do
      post "/api/v1/property_definitions",
           params: { property_definition: { item_type_id: item_type.id, key: "読み仮名", label: "x" } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "GET /api/v1/property_definitions" do
    it "自分のものだけ、種別で絞って順番どおりに返す" do
      other_type = ItemType.find_or_create_by!(name: "person") { |t| t.label = "人物" }
      define!(key: "b", label: "B")
      define!(key: "a", label: "A")
      define!(key: "c", label: "C", type: other_type)
      define!(key: "z", label: "よそ", owner: create(:user, :confirmed))

      get "/api/v1/property_definitions", params: { item_type_id: item_type.id }, headers: headers

      expect(json_response["property_definitions"].map { |d| d["key"] }).to eq(%w[b a])
    end
  end

  describe "PATCH /api/v1/property_definitions/:id" do
    it "ラベルと型を変えられる" do
      definition = define!(key: "reading", label: "読み")

      patch "/api/v1/property_definitions/#{definition.id}",
            params: { property_definition: { label: "読み仮名", value_type: "list" } }, headers: headers

      expect(definition.reload.label).to eq("読み仮名")
      expect(definition.value_type).to eq("list")
    end

    it "key は変えられない（入っている値が辿れなくなるため）" do
      definition = define!(key: "reading")

      patch "/api/v1/property_definitions/#{definition.id}",
            params: { property_definition: { key: "changed", label: "読み仮名" } }, headers: headers

      expect(definition.reload.key).to eq("reading")
    end

    it "他ユーザーのものは 404" do
      foreign = define!(key: "x", owner: create(:user, :confirmed))

      patch "/api/v1/property_definitions/#{foreign.id}",
            params: { property_definition: { label: "書き換え" } }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/property_definitions/:id" do
    it "定義を消すと、そこに入っていた値も消える" do
      definition = define!(key: "reading")
      item = create(:item, user: user, item_type: item_type)
      item.item_properties.create!(property_definition: definition, value: { "v" => "こうごうせい" })

      delete "/api/v1/property_definitions/#{definition.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(ItemProperty.count).to eq(0)
    end
  end

  describe "PATCH /api/v1/property_definitions/reorder" do
    it "渡した順に並べ替える" do
      a = define!(key: "a")
      b = define!(key: "b")
      c = define!(key: "c")

      patch "/api/v1/property_definitions/reorder", params: { ids: [ c.id, a.id, b.id ] }, headers: headers

      expect(user.property_definitions.ordered.map(&:key)).to eq(%w[c a b])
    end
  end
end
