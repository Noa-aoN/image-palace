require "rails_helper"

RSpec.describe "Rack::Attack throttling for high-cost endpoints", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user, title: "cat") }

  describe "意味生成のスロットル（OpenAI コスト）" do
    before { allow(GenerateMeaningService).to receive(:call) }

    it "10 回を超えると 429 を返す" do
      11.times { post "/api/v1/items/#{item.id}/meaning", headers: headers }
      expect(response).to have_http_status(:too_many_requests)
    end

    it "上限内はスロットルしない" do
      10.times { post "/api/v1/items/#{item.id}/meaning", headers: headers }
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "再生成のスロットル" do
    it "20 回を超えると 429 を返す" do
      21.times { post "/api/v1/items/#{item.id}/retry", headers: headers }
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "データエクスポートのスロットル" do
    it "10 回を超えると 429 を返す" do
      11.times { get "/api/v1/account/export", headers: headers }
      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
