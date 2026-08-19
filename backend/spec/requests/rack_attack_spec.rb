require "rails_helper"

RSpec.describe "Rack::Attack throttling", type: :request do
  # スロットルは period 秒ごとの離散バケットでカウントするため、リクエスト列が
  # バケット境界をまたぐとカウントが分割されてフレークする。freeze_time で 1 バケットに固定する。
  # **X-Forwarded-For は呼ぶ側が自由に付けられる。**
  # 信頼するプロキシを設定していないと、このヘッダーを毎回変えるだけで
  # 上限をすり抜けられてしまう。数える相手は Fly が上書きする値を使う
  describe "数える相手（IP）の決め方" do
    def sign_in_attempt(headers)
      post "/api/v1/auth/sign_in",
        params: { email: "nobody@example.com", password: "wrong-password" },
        headers: headers, as: :json
    end

    it "X-Forwarded-For を毎回変えても、上限をすり抜けられない" do
      freeze_time do
        11.times do |i|
          sign_in_attempt("HTTP_X_FORWARDED_FOR" => "203.0.113.#{i}")
        end
      end

      expect(response).to have_http_status(:too_many_requests)
    end

    it "Fly-Client-IP が違えば、別の相手として数える" do
      freeze_time do
        11.times do |i|
          sign_in_attempt("HTTP_FLY_CLIENT_IP" => "198.51.100.#{i}")
        end
      end

      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "Fly-Client-IP が同じなら、X-Forwarded-For を変えても同じ相手として数える" do
      freeze_time do
        11.times do |i|
          sign_in_attempt("HTTP_FLY_CLIENT_IP" => "198.51.100.1",
                          "HTTP_X_FORWARDED_FOR" => "203.0.113.#{i}")
        end
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "ログイン試行のスロットル" do
    it "10 回を超えると 429 を返す" do
      freeze_time do
        11.times do
          post "/api/v1/auth/sign_in",
            params: { email: "nobody@example.com", password: "wrong-password" }, as: :json
        end
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.headers["Retry-After"]).to eq("20")
      expect(JSON.parse(response.body)["error"]).to include("リクエストが多すぎます")
    end

    it "上限内のリクエストはスロットルしない" do
      freeze_time do
        10.times do
          post "/api/v1/auth/sign_in",
            params: { email: "nobody@example.com", password: "wrong-password" }, as: :json
        end
      end

      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  # 認証の入口なのに、ここだけ個別のスロットルが無く全体網（300回/5分）に頼っていた。
  # 送らせる側（メール爆撃）と当てにいく側（トークン総当たり）の両方がある
  describe "パスワード再設定のスロットル" do
    it "5 回を超えると 429 を返す" do
      freeze_time do
        6.times do
          post "/api/v1/auth/password", params: { email: "nobody@example.com" }, as: :json
        end
      end

      expect(response).to have_http_status(:too_many_requests)
    end

    it "上限内は通す" do
      freeze_time do
        5.times do
          post "/api/v1/auth/password", params: { email: "nobody@example.com" }, as: :json
        end
      end

      expect(response).not_to have_http_status(:too_many_requests)
    end

    # 発行済みトークンを当てにいく経路も同じ入口として数える
    it "トークンを当てにいく PUT も同じ枠で数える" do
      freeze_time do
        3.times { post "/api/v1/auth/password", params: { email: "nobody@example.com" }, as: :json }
        3.times do
          put "/api/v1/auth/password",
            params: { reset_password_token: "guess", password: "x", password_confirmation: "x" }, as: :json
        end
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "メール確認のスロットル" do
    it "5 回を超えると 429 を返す" do
      freeze_time do
        6.times { get "/api/v1/auth/confirmation", params: { confirmation_token: "guess" } }
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "新規登録のスロットル" do
    it "5 回を超えると 429 を返す" do
      freeze_time do
        6.times do |i|
          post "/api/v1/auth",
            params: { email: "spam#{i}@example.com", password: "password123", password_confirmation: "password123" },
            as: :json
        end
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
