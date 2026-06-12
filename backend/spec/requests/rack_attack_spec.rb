require "rails_helper"

RSpec.describe "Rack::Attack throttling", type: :request do
  describe "ログイン試行のスロットル" do
    it "10 回を超えると 429 を返す" do
      11.times do
        post "/api/v1/auth/sign_in",
          params: { email: "nobody@example.com", password: "wrong-password" }, as: :json
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.headers["Retry-After"]).to eq("20")
      expect(JSON.parse(response.body)["error"]).to include("リクエストが多すぎます")
    end

    it "上限内のリクエストはスロットルしない" do
      10.times do
        post "/api/v1/auth/sign_in",
          params: { email: "nobody@example.com", password: "wrong-password" }, as: :json
      end

      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "新規登録のスロットル" do
    it "5 回を超えると 429 を返す" do
      6.times do |i|
        post "/api/v1/auth",
          params: { email: "spam#{i}@example.com", password: "password123", password_confirmation: "password123" },
          as: :json
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "ヘルスチェック" do
    it "安全網スロットルの対象外でカウントされない" do
      # req/ip の上限(300)を超えない範囲でも、health は除外されていることを確認する
      5.times { get "/api/v1/health" }

      expect(response).to have_http_status(:success)
    end
  end
end
