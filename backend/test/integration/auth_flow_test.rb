require "test_helper"

class AuthFlowTest < ActionDispatch::IntegrationTest
  setup do
    @original_frontend_url = ENV["FRONTEND_URL"]
    ENV["FRONTEND_URL"] = "http://localhost:3000"
  end

  teardown do
    ENV["FRONTEND_URL"] = @original_frontend_url
  end

  test "signs up without confirm_success_url and returns auth headers" do
    email = "signup-#{SecureRandom.hex(4)}@example.com"

    post "/api/v1/auth", params: {
      email: email,
      password: "password123",
      password_confirmation: "password123"
    }, as: :json

    assert_response :success
    assert_equal "application/json; charset=utf-8", response.content_type
    assert response.headers["access-token"].present?
    assert response.headers["client"].present?
    assert response.headers["uid"].present?

    body = json_response
    assert_equal "email", body.dig("data", "provider")
    assert_equal email, body.dig("data", "email")
    assert User.find_by!(email: email).confirmed?

    get "/api/v1/health/authenticated", headers: auth_headers_from_response
    assert_response :success
    assert_equal email, json_response.dig("user", "email")
  end

  test "logs in with email and password and returns auth headers" do
    user = create_confirmed_user(email: "login-#{SecureRandom.hex(4)}@example.com")

    post "/api/v1/auth/sign_in", params: {
      email: user.email,
      password: "password123"
    }, as: :json

    assert_response :success
    assert response.headers["access-token"].present?
    assert_equal user.email, response.headers["uid"]

    body = json_response
    assert_equal user.email, body.dig("data", "email")

    get "/api/v1/health/authenticated", headers: auth_headers_from_response
    assert_response :success
    assert_equal user.email, json_response.dig("user", "email")
  end

  test "rejects duplicate email signup" do
    existing_user = create_confirmed_user(email: "duplicate-#{SecureRandom.hex(4)}@example.com")

    post "/api/v1/auth", params: {
      email: existing_user.email,
      password: "password123",
      password_confirmation: "password123"
    }, as: :json

    assert_response :unprocessable_content
    assert_includes json_response.dig("errors", "full_messages"), "Email has already been taken"
  end

  test "rejects invalid email format on signup" do
    post "/api/v1/auth", params: {
      email: "plainaddress",
      password: "password123",
      password_confirmation: "password123"
    }, as: :json

    assert_response :unprocessable_content
    assert_includes json_response.dig("errors", "full_messages"), "Email is not an email"
  end

  test "rejects password confirmation mismatch on signup" do
    post "/api/v1/auth", params: {
      email: "mismatch-#{SecureRandom.hex(4)}@example.com",
      password: "password123",
      password_confirmation: "password124"
    }, as: :json

    assert_response :unprocessable_content
    assert_includes json_response.dig("errors", "full_messages"), "Password confirmation doesn't match Password"
  end

  test "rejects signup when frontend_url is invalid and confirm_success_url is omitted" do
    ENV["FRONTEND_URL"] = "invalid-url"

    post "/api/v1/auth", params: {
      email: "frontend-url-#{SecureRandom.hex(4)}@example.com",
      password: "password123",
      password_confirmation: "password123"
    }, as: :json

    assert_response :bad_request
  end

  test "rejects login with an invalid password" do
    user = create_confirmed_user(email: "bad-password-#{SecureRandom.hex(4)}@example.com")

    post "/api/v1/auth/sign_in", params: {
      email: user.email,
      password: "wrong-password"
    }, as: :json

    assert_response :unauthorized
  end

  test "rejects login for an unknown email" do
    post "/api/v1/auth/sign_in", params: {
      email: "missing-#{SecureRandom.hex(4)}@example.com",
      password: "password123"
    }, as: :json

    assert_response :unauthorized
  end

  private

  def auth_headers_from_response
    {
      "access-token" => response.headers["access-token"],
      "client" => response.headers["client"],
      "uid" => response.headers["uid"]
    }
  end
end
