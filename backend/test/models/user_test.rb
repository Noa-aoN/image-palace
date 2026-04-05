require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "is invalid when password is shorter than 8 characters" do
    user = User.new(
      email: "short-password@example.com",
      password: "1234567",
      password_confirmation: "1234567",
      provider: "email",
      uid: "short-password@example.com",
      confirmed_at: Time.current
    )

    assert_not user.valid?
    assert_includes user.errors[:password], "is too short (minimum is 8 characters)"
  end

  test "is valid when password has 8 characters" do
    user = User.new(
      email: "valid-password@example.com",
      password: "12345678",
      password_confirmation: "12345678",
      provider: "email",
      uid: "valid-password@example.com",
      confirmed_at: Time.current
    )

    assert user.valid?
  end
end
