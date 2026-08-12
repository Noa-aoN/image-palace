require "rails_helper"

# 止められることが要。作りかけや不具合や締め出しが起きたとき、
# 環境変数ひとつで元の姿へ戻せなければならない。
RSpec.describe Auth::StrongAuth do
  let(:user) { create(:user, :confirmed) }

  def with_env(key, value)
    original = ENV[key]
    ENV[key] = value
    yield
  ensure
    ENV[key] = original
  end

  describe "Passkey の栓" do
    it "既定では使える" do
      with_env("PASSKEY_ENABLED", nil) { expect(described_class.passkey_enabled?).to be(true) }
    end

    it "false で閉じる" do
      with_env("PASSKEY_ENABLED", "false") { expect(described_class.passkey_enabled?).to be(false) }
    end
  end

  describe "運営への強い確認の栓" do
    # 最初から全員に求めない。段階的に入れるための栓
    it "既定では求めない" do
      with_env("ADMIN_STRONG_AUTH_ENABLED", nil) { expect(described_class.admin_required?).to be(false) }
    end

    it "true で求める" do
      with_env("ADMIN_STRONG_AUTH_ENABLED", "true") { expect(described_class.admin_required?).to be(true) }
    end
  end

  describe "使える確かめ方" do
    it "何も用意していなければ空" do
      expect(described_class.available_methods(user)).to eq([])
      expect(described_class.prepared?(user)).to be(false)
    end

    it "認証アプリだけでも用意したことになる（Passkey を強いない）" do
      user.start_totp_enrollment!
      user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(described_class.available_methods(user.reload)).to include("totp")
      expect(described_class.prepared?(user)).to be(true)
    end

    it "Passkey があれば先に出す（使いやすいものから）" do
      user.webauthn_credentials.create!(external_id: SecureRandom.hex(16), public_key: "pk")
      user.start_totp_enrollment!
      user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(described_class.available_methods(user.reload).first).to eq("passkey")
    end

    # 画面から消すだけでは足りない。API を直に叩けば通ってしまう
    it "栓を閉じると、鍵を持っていても候補に出さない" do
      user.webauthn_credentials.create!(external_id: SecureRandom.hex(16), public_key: "pk")

      with_env("PASSKEY_ENABLED", "false") do
        expect(described_class.available_methods(user.reload)).not_to include("passkey")
      end
    end

    # 閉じても、既に登録した鍵は消さない（また入にしたとき使える）
    it "栓を閉じても、登録した鍵は残る" do
      user.webauthn_credentials.create!(external_id: SecureRandom.hex(16), public_key: "pk")

      with_env("PASSKEY_ENABLED", "false") do
        expect(user.reload.webauthn_credentials.count).to eq(1)
      end
    end

    it "Passkey を閉じても認証アプリには影響しない" do
      user.start_totp_enrollment!
      user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      with_env("PASSKEY_ENABLED", "false") do
        expect(described_class.available_methods(user.reload)).to include("totp")
      end
    end

    it "復旧コードは最後に置く" do
      user.start_totp_enrollment!
      user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(described_class.available_methods(user.reload).last).to eq("recovery_code")
    end
  end
end
