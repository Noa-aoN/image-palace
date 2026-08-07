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
      expect(json_response["block_view"]).to eq({ "hidden" => [ "tags" ], "order" => [ "meanings", "item_type" ] })
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
end
