require "rails_helper"

RSpec.describe "Api::V1::Items brief", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "機会費用") }

  let(:resolved) do
    Images::BriefService::Result.new(
      description: "諦めた選択肢の価値のこと。",
      subject_kind: "abstract",
      scene_prompt: "A person at a fork in a country road at dusk",
      model: "gpt-4o-mini"
    )
  end

  before { allow(Images::BriefResolver).to receive(:call).and_return(resolved) }

  describe "POST /api/v1/items/:id/brief" do
    it "認証なしでは 401" do
      post "/api/v1/items/#{item.id}/brief", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "既定では説明文と画像への指示を保存する" do
      post "/api/v1/items/#{item.id}/brief", headers: headers

      expect(response).to have_http_status(:success)
      expect(item.reload.scene_prompt).to eq("A person at a fork in a country road at dusk")
      expect(item.image_description).to eq("諦めた選択肢の価値のこと。")
    end

    it "preview=true では保存せず、下書きだけを返す" do
      item.update!(scene_prompt: "手で書いた指示", image_description: "手で書いた説明")

      post "/api/v1/items/#{item.id}/brief", params: { preview: true }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["scene_prompt"]).to eq("A person at a fork in a country road at dusk")
      expect(json_response["image_description"]).to eq("諦めた選択肢の価値のこと。")
      # 押した瞬間に手で書いたものが消えない（保存は「この内容で作り直す」まで待つ）
      expect(item.reload.scene_prompt).to eq("手で書いた指示")
      expect(item.image_description).to eq("手で書いた説明")
    end

    it "他ユーザーのアイテムは 404" do
      other_item = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{other_item.id}/brief", params: { preview: true }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
