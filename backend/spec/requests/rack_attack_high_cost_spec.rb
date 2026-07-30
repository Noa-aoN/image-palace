require "rails_helper"

RSpec.describe "Rack::Attack throttling for high-cost endpoints", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user, title: "cat") }

  # スロットルは period 秒ごとの離散バケットでカウントするため、リクエスト列が
  # バケット境界をまたぐとカウントが分割されてフレークする。freeze_time で 1 バケットに固定する。
  describe "意味生成のスロットル（OpenAI コスト）" do
    before { allow(GenerateMeaningService).to receive(:call) }

    it "30 回を超えると 429 を返す" do
      freeze_time { 31.times { post "/api/v1/items/#{item.id}/meaning", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end

    it "上限内はスロットルしない" do
      freeze_time { 30.times { post "/api/v1/items/#{item.id}/meaning", headers: headers } }
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "タグ生成のスロットル（OpenAI コスト）" do
    before { allow(GenerateTagsService).to receive(:call) }

    it "30 回を超えると 429 を返す" do
      freeze_time { 31.times { post "/api/v1/items/#{item.id}/tags", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end

    it "上限内はスロットルしない" do
      freeze_time { 30.times { post "/api/v1/items/#{item.id}/tags", headers: headers } }
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "ファクトチェックのスロットル（OpenAI コスト）" do
    before { allow(GenerateFactCheckService).to receive(:call) }

    it "30 回を超えると 429 を返す" do
      freeze_time { 31.times { post "/api/v1/items/#{item.id}/fact_check", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "再生成のスロットル" do
    it "20 回を超えると 429 を返す" do
      freeze_time { 21.times { post "/api/v1/items/#{item.id}/retry", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "データエクスポートのスロットル" do
    it "10 回を超えると 429 を返す" do
      freeze_time { 11.times { get "/api/v1/account/export", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  # 1件最大 10MB を libvips でデコードするため、転送量と CPU の両方が高コスト
  describe "画像アップロードのスロットル" do
    let(:box) { user.boxes.create!(name: "英単語") }

    it "20 回を超えると 429 を返す" do
      freeze_time { 21.times { post "/api/v1/boxes/#{box.id}/cover_image", headers: headers } }
      expect(response).to have_http_status(:too_many_requests)
    end

    it "上限内はスロットルしない" do
      freeze_time { 20.times { post "/api/v1/boxes/#{box.id}/cover_image", headers: headers } }
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "スペースの背景画像も同じ上限で数える" do
      space = create(:space, user: user)
      freeze_time do
        10.times { post "/api/v1/boxes/#{box.id}/cover_image", headers: headers }
        11.times { post "/api/v1/spaces/#{space.id}/cover_image", headers: headers }
      end
      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
