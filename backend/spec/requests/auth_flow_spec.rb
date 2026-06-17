require "rails_helper"

RSpec.describe "Auth flow", type: :request do
  before do
    @original_frontend_url = ENV["FRONTEND_URL"]
    ENV["FRONTEND_URL"] = "http://localhost:3000"
  end

  after do
    ENV["FRONTEND_URL"] = @original_frontend_url
  end

  describe "POST /api/v1/auth (signup)" do
    it "signs up without confirm_success_url and returns auth headers" do
      email = "signup-#{SecureRandom.hex(4)}@example.com"

      post "/api/v1/auth", params: {
        email: email,
        password: "password123",
        password_confirmation: "password123"
      }, as: :json

      expect(response).to have_http_status(:success)
      expect(response.content_type).to eq("application/json; charset=utf-8")
      expect(response.headers["access-token"]).to be_present
      expect(response.headers["client"]).to be_present
      expect(response.headers["uid"]).to be_present

      expect(json_response.dig("data", "provider")).to eq("email")
      expect(json_response.dig("data", "email")).to eq(email)
      expect(User.find_by!(email: email)).to be_confirmed

      get "/api/v1/health/authenticated", headers: auth_headers_from_response
      expect(response).to have_http_status(:success)
      expect(json_response.dig("user", "email")).to eq(email)
    end

    it "rejects duplicate email signup" do
      existing_user = create(:user, :confirmed, email: "duplicate-#{SecureRandom.hex(4)}@example.com")

      post "/api/v1/auth", params: {
        email: existing_user.email,
        password: "password123",
        password_confirmation: "password123"
      }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response.dig("errors", "full_messages")).to include("Email has already been taken")
    end

    it "rejects invalid email format on signup" do
      post "/api/v1/auth", params: {
        email: "plainaddress",
        password: "password123",
        password_confirmation: "password123"
      }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response.dig("errors", "full_messages")).to include("Email is not an email")
    end

    it "rejects password confirmation mismatch on signup" do
      post "/api/v1/auth", params: {
        email: "mismatch-#{SecureRandom.hex(4)}@example.com",
        password: "password123",
        password_confirmation: "password124"
      }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response.dig("errors", "full_messages")).to include("Password confirmation doesn't match Password")
    end

    it "rejects signup when frontend_url is invalid and confirm_success_url is omitted" do
      ENV["FRONTEND_URL"] = "invalid-url"

      post "/api/v1/auth", params: {
        email: "frontend-url-#{SecureRandom.hex(4)}@example.com",
        password: "password123",
        password_confirmation: "password123"
      }, as: :json

      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "POST /api/v1/auth/password (request password reset)" do
    it "accepts a reset request and enqueues a reset email for an existing user" do
      user = create(:user, :confirmed, email: "reset-#{SecureRandom.hex(4)}@example.com")

      expect {
        post "/api/v1/auth/password", params: {
          email: user.email,
          redirect_url: "http://localhost:3000/reset-password"
        }, as: :json
      }.to change { ActionMailer::Base.deliveries.size }.by(1)

      expect(response).to have_http_status(:success)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.to).to include(user.email)
      expect(mail.body.encoded).to include("reset_password_token")
    end

    it "rejects a reset request without a redirect_url" do
      user = create(:user, :confirmed, email: "no-url-#{SecureRandom.hex(4)}@example.com")

      post "/api/v1/auth/password", params: {
        email: user.email
      }, as: :json

      expect(response).to have_http_status(:unauthorized).or have_http_status(:unprocessable_content)
    end

    it "returns not_found for an unknown email" do
      post "/api/v1/auth/password", params: {
        email: "missing-#{SecureRandom.hex(4)}@example.com",
        redirect_url: "http://localhost:3000/reset-password"
      }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PUT /api/v1/auth/password (apply password reset)" do
    it "updates the password when authenticated with allow_password_change flag" do
      user = create(:user, :confirmed, email: "apply-#{SecureRandom.hex(4)}@example.com")
      user.update!(allow_password_change: true)
      headers = user.create_new_auth_token

      put "/api/v1/auth/password", params: {
        password: "new-password-123",
        password_confirmation: "new-password-123"
      }, headers: headers, as: :json

      expect(response).to have_http_status(:success)

      user.reload
      expect(user.valid_password?("new-password-123")).to be(true)

      post "/api/v1/auth/sign_in", params: {
        email: user.email,
        password: "new-password-123"
      }, as: :json
      expect(response).to have_http_status(:success)
    end

    it "rejects the update without auth headers" do
      put "/api/v1/auth/password", params: {
        password: "another-password",
        password_confirmation: "another-password"
      }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects when password and confirmation do not match" do
      user = create(:user, :confirmed, email: "mismatch-reset-#{SecureRandom.hex(4)}@example.com")
      user.update!(allow_password_change: true)
      headers = user.create_new_auth_token

      put "/api/v1/auth/password", params: {
        password: "new-password-123",
        password_confirmation: "new-password-456"
      }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "GET /api/v1/auth/:provider (OmniAuth リクエストフェーズ)" do
    # 本番で /api/v1/auth/google_oauth2 が devise_token_auth の redirect ルート内の
    # CGI.parse で NoMethodError(500) になり、Google 認証を開始できなかった回帰を防ぐ。
    # CGI.parse が利用可能であれば、Google へのリダイレクト(3xx)が返る。
    it "google_oauth2 開始時に 500 を出さずリダイレクトする" do
      # devise_token_auth の redirect ルートは QUERY_STRING を CGI.parse する。
      # 実運用と同様にクエリ文字列を付与して、その経路（本番で 500 になっていた箇所）を通す。
      get "/api/v1/auth/google_oauth2", params: { auth_origin_url: "http://localhost:3000" }

      expect(response).to have_http_status(:redirect)
    end
  end

  describe "POST /api/v1/auth/sign_in (login)" do
    it "logs in with email and password and returns auth headers" do
      user = create(:user, :confirmed, email: "login-#{SecureRandom.hex(4)}@example.com")

      post "/api/v1/auth/sign_in", params: {
        email: user.email,
        password: "password123"
      }, as: :json

      expect(response).to have_http_status(:success)
      expect(response.headers["access-token"]).to be_present
      expect(response.headers["uid"]).to eq(user.email)

      expect(json_response.dig("data", "email")).to eq(user.email)

      get "/api/v1/health/authenticated", headers: auth_headers_from_response
      expect(response).to have_http_status(:success)
      expect(json_response.dig("user", "email")).to eq(user.email)
    end

    it "rejects login with an invalid password" do
      user = create(:user, :confirmed, email: "bad-password-#{SecureRandom.hex(4)}@example.com")

      post "/api/v1/auth/sign_in", params: {
        email: user.email,
        password: "wrong-password"
      }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects login for an unknown email" do
      post "/api/v1/auth/sign_in", params: {
        email: "missing-#{SecureRandom.hex(4)}@example.com",
        password: "password123"
      }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
