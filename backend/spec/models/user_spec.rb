require "rails_helper"

RSpec.describe User, type: :model do
  describe "password length validation" do
    it "is invalid when password is shorter than 8 characters" do
      user = User.new(
        email: "short-password@example.com",
        password: "1234567",
        password_confirmation: "1234567",
        provider: "email",
        uid: "short-password@example.com",
        confirmed_at: Time.current
      )

      expect(user).to be_invalid
      expect(user.errors[:password]).to include("is too short (minimum is 8 characters)")
    end

    it "is valid when password has 8 characters" do
      user = User.new(
        email: "valid-password@example.com",
        password: "12345678",
        password_confirmation: "12345678",
        provider: "email",
        uid: "valid-password@example.com",
        confirmed_at: Time.current
      )

      expect(user).to be_valid
    end
  end
end
