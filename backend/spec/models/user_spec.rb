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

  describe "email validation" do
    it "is invalid with a malformed email" do
      user = build(:user, email: "not-an-email")
      expect(user).to be_invalid
      expect(user.errors[:email]).to include("is not an email")
    end

    it "rejects duplicate email within the same provider" do
      create(:user, :confirmed, email: "dup-#{SecureRandom.hex(4)}@example.com")
      duplicate = build(:user, email: User.last.email)
      expect(duplicate).to be_invalid
      expect(duplicate.errors[:email]).to include("has already been taken")
    end
  end

  describe ".find_for_oauth" do
    let(:auth_hash) do
      {
        "provider" => "google_oauth2",
        "uid" => "oauth-uid-#{SecureRandom.hex(4)}",
        "info" => { "email" => "oauth-#{SecureRandom.hex(4)}@example.com", "name" => "OAuth User" }
      }
    end

    it "creates a confirmed user when no matching record exists" do
      expect {
        described_class.find_for_oauth(auth_hash)
      }.to change(described_class, :count).by(1)

      user = described_class.find_by(provider: auth_hash["provider"], uid: auth_hash["uid"])
      expect(user).to be_present
      expect(user).to be_confirmed
      expect(user.email).to eq(auth_hash["info"]["email"])
      expect(user.name).to eq("OAuth User")
    end

    it "returns the existing user when provider + uid already match" do
      existing = described_class.find_for_oauth(auth_hash)

      expect {
        result = described_class.find_for_oauth(auth_hash)
        expect(result).to eq(existing)
      }.not_to change(described_class, :count)
    end

    it "creates an Apple user even when name is omitted (Apple は名前を返さないことがある)" do
      apple_hash = {
        "provider" => "apple",
        "uid" => "apple-uid-#{SecureRandom.hex(4)}",
        "info" => { "email" => "apple-#{SecureRandom.hex(4)}@privaterelay.appleid.com", "name" => nil }
      }

      expect {
        described_class.find_for_oauth(apple_hash)
      }.to change(described_class, :count).by(1)

      user = described_class.find_by(provider: "apple", uid: apple_hash["uid"])
      expect(user).to be_confirmed
      expect(user.email).to eq(apple_hash["info"]["email"])
      expect(user.name).to be_nil
    end
  end

  describe "#touch_last_seen!" do
    let(:user) { create(:user, :confirmed) }

    it "初めて来た日に記録する" do
      expect { user.touch_last_seen! }.to change { user.reload.last_seen_at }.from(nil)
    end

    it "同じ日のうちは書き直さない" do
      # 時刻を決め打つ。いまの時刻から3時間進めると、**実行した時間帯によっては
      # 日付をまたぐ**（深夜に流すと落ちる）
      morning = Time.zone.local(2026, 8, 12, 9, 0)
      travel_to(morning) { user.touch_last_seen! }

      travel_to(morning + 3.hours) do
        expect { user.touch_last_seen! }.not_to(change { user.reload.last_seen_at })
      end
    end

    it "日付が変わったら書き直す" do
      today = Time.zone.local(2026, 8, 12, 23, 30)
      travel_to(today) { user.touch_last_seen! }

      travel_to(today + 1.hour) do # 日付が変わった直後
        expect { user.touch_last_seen! }.to(change { user.reload.last_seen_at })
        expect(user.reload.last_seen_at.to_date).to eq(Date.new(2026, 8, 13))
      end
    end

    it "updated_at を動かさない（利用者が何かを変えた時刻の意味を守る）" do
      user
      expect { user.touch_last_seen! }.not_to(change { user.reload.updated_at })
    end
  end
end
