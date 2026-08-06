require "rails_helper"

RSpec.describe "Api::V1::Items scene_rewrite", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "機会費用") }

  describe "POST /api/v1/items/:id/scene_rewrite" do
    it "認証なしでは 401" do
      post "/api/v1/items/#{item.id}/scene_rewrite", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "書き直した候補だけを返し、保存はしない" do
      item.update!(scene_prompt: "an old draft scene")
      allow(Images::SceneRewriteService).to receive(:call).and_return(
        Images::SceneRewriteService::Result.new(
          options: [ Images::SceneRewriteService::Option.new(label: "経済学の用語", scene_prompt: "a rewritten scene") ],
          model: "gpt-4o-mini"
        )
      )

      post "/api/v1/items/#{item.id}/scene_rewrite", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["options"]).to eq([ { "label" => "経済学の用語", "scene_prompt" => "a rewritten scene" } ])
      expect(item.reload.scene_prompt).to eq("an old draft scene")
    end

    it "書き直せなかったら 422" do
      allow(Images::SceneRewriteService).to receive(:call)
        .and_raise(Images::SceneRewriteService::RewriteError, "このカードには意味・説明がありません")

      post "/api/v1/items/#{item.id}/scene_rewrite", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to include("意味・説明がありません")
    end

    it "AI の利用上限に達していたら 429" do
      allow(Images::SceneRewriteService).to receive(:call).and_raise(Ai::Chat::LimitExceeded, "上限に達しました")

      post "/api/v1/items/#{item.id}/scene_rewrite", headers: headers

      expect(response).to have_http_status(:too_many_requests)
    end

    it "他ユーザーのアイテムは 404" do
      other_item = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{other_item.id}/scene_rewrite", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
