require "rails_helper"

RSpec.describe "Api::V1::Items block_view", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "光合成") }

  describe "PATCH /api/v1/items/:id/block_view" do
    it "認証なしでは 401" do
      patch "/api/v1/items/#{item.id}/block_view", params: { hidden: [] }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "隠すブロックと並び順を保存する" do
      patch "/api/v1/items/#{item.id}/block_view",
            params: { hidden: [ "tags" ], order: [ "meanings", "item_type" ] }, headers: headers

      expect(response).to have_http_status(:success)
      expect(item.reload.hidden_block_keys).to eq([ "tags" ])
      expect(item.ordered_block_keys).to eq([ "meanings", "item_type" ])
      expect(json_response["block_view"]).to eq(
        { "hidden" => [ "tags" ], "order" => [ "meanings", "item_type" ], "omitted" => [] }
      )
    end

    it "空を渡すと元に戻る" do
      item.update!(block_view: { "hidden" => [ "tags" ], "order" => [ "meanings" ] })

      patch "/api/v1/items/#{item.id}/block_view", params: { hidden: [], order: [] }, headers: headers

      expect(item.reload.hidden_block_keys).to eq([])
      expect(item.ordered_block_keys).to eq([])
    end

    it "重複と空文字は落とす" do
      patch "/api/v1/items/#{item.id}/block_view",
            params: { hidden: [ "tags", "tags", "", "  " ] }, headers: headers

      expect(item.reload.hidden_block_keys).to eq([ "tags" ])
    end

    it "件数と長さに歯止めがある（metadata を肥らせない）" do
      patch "/api/v1/items/#{item.id}/block_view",
            params: { hidden: (1..200).map { |i| "k#{i}" }, order: [ "a" * 200 ] }, headers: headers

      expect(item.reload.hidden_block_keys.size).to eq(Item::MAX_BLOCK_KEYS)
      expect(item.ordered_block_keys.first.length).to eq(Item::MAX_BLOCK_KEY_LENGTH)
    end

    it "他ユーザーのカードは 404" do
      other = create(:item, user: create(:user, :confirmed))

      patch "/api/v1/items/#{other.id}/block_view", params: { hidden: [ "tags" ] }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  # 「持たない」と「畳む」は意味が違う。どちらも見えないが、
  # 持たない項目は AI の穴埋めの対象からも外れる
  describe "持たない項目（− のエリア）" do
    it "保存して読み返せる" do
      patch "/api/v1/items/#{item.id}/block_view",
            params: { hidden: [ "tags" ], order: [ "meanings" ], omitted: [ "examples" ] }, headers: headers

      expect(response).to have_http_status(:success)
      expect(item.reload.omitted_block_keys).to eq([ "examples" ])
      expect(response.parsed_body.dig("block_view", "omitted")).to eq([ "examples" ])
    end

    it "持たない項目は AI の穴埋めから外れる" do
      item_type = item.item_type
      user.property_definitions.create!(item_type: item_type, key: "reading", label: "読み方", value_type: "text")
      user.property_definitions.create!(item_type: item_type, key: "aliases", label: "別名", value_type: "text")
      item.update!(block_view: { "omitted" => [ "prop:aliases" ] })

      service = Items::FillPropertiesService.new(item: item, user: user)
      keys = service.send(:definitions).map(&:key)

      expect(keys).to eq([ "reading" ])
    end
  end
end
