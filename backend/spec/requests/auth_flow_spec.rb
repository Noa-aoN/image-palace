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
