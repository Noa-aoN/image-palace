require "rails_helper"

RSpec.describe "利用者の二要素認証", type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "登録の始め" do
    it "秘密鍵を作るが、**まだ有効にしない**" do
      user.start_totp_enrollment!

      expect(user.totp_secret).to be_present
      # 鍵を作った時点で有効にすると、認証アプリへの登録に失敗した人が締め出される
      expect(user.totp_enrolled?).to be(false)
    end

    it "やり直すと前の鍵は使えなくなる" do
      first = user.start_totp_enrollment!
      second = user.start_totp_enrollment!

      expect(second).not_to eq(first)
      expect(Auth::Totp.verify(user.reload.totp_secret, Auth::Totp.code_at(first))).to be(false)
    end
  end

  describe "確認" do
    before { user.start_totp_enrollment! }

    it "コードが合えば有効になる" do
      user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(user.reload.totp_enrolled?).to be(true)
    end

    it "コードが違えば有効にならない" do
      expect(user.confirm_totp!("000000")).to be_nil
      expect(user.reload.totp_enrolled?).to be(false)
    end

    # 端末を失うと詰む。必ず配る
    it "復旧コードを配る" do
      codes = user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(codes.size).to eq(User::TOTP_RECOVERY_CODE_COUNT)
      expect(codes.uniq.size).to eq(codes.size)
    end

    # 生のまま持つと、漏れた時点で二要素を回避できる
    it "復旧コードは生のまま保存しない" do
      codes = user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))

      expect(user.reload.totp_recovery_codes).not_to include(codes.first)
    end
  end

  describe "確かめる" do
    before do
      user.start_totp_enrollment!
      @codes = user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))
    end

    it "認証アプリのコードで通る" do
      expect(user.verify_totp(Auth::Totp.code_at(user.totp_secret))).to be(true)
    end

    it "復旧コードでも通る" do
      expect(user.verify_totp(@codes.first)).to be(true)
    end

    # 一度使ったコードが使い回せると、盗み見た1つで何度でも入れる
    it "復旧コードは使い捨て" do
      user.verify_totp(@codes.first)

      expect(user.reload.verify_totp(@codes.first)).to be(false)
    end

    it "使った1本だけが減る" do
      expect { user.verify_totp(@codes.first) }
        .to change { user.reload.totp_recovery_codes.size }.by(-1)
    end

    it "でたらめな値は通らない" do
      expect(user.verify_totp("000000")).to be(false)
      expect(user.verify_totp("nonexistent")).to be(false)
    end

    it "設定していない人は、何を出しても通らない" do
      other = create(:user, :confirmed)

      expect(other.verify_totp("123456")).to be(false)
    end
  end

  describe "秘密鍵の保存" do
    # DB が漏れた時点で二要素が二要素でなくなる
    it "生のまま保存しない" do
      secret = user.start_totp_enrollment!
      stored = User.connection.select_value("SELECT totp_secret FROM users WHERE id = '#{user.id}'")

      expect(stored).to be_present
      expect(stored).not_to include(secret)
    end
  end
end
