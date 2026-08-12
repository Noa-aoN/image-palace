require "rails_helper"

RSpec.describe WebauthnCredential, type: :model do
  let(:user) { create(:user, :confirmed) }

  def credential!(user:, external_id: SecureRandom.hex(16), **attrs)
    described_class.create!(user: user, external_id: external_id, public_key: "pk", **attrs)
  end

  describe "登録" do
    # 1本しか登録できないと、その端末を失った時点で入れなくなる
    it "1人が何本でも持てる" do
      credential!(user: user)
      credential!(user: user)

      expect(user.reload.webauthn_credentials.count).to eq(2)
    end

    it "同じ鍵は二度登録できない" do
      id = SecureRandom.hex(16)
      credential!(user: user, external_id: id)

      expect { credential!(user: create(:user, :confirmed), external_id: id) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end

    it "利用者が消えたら鍵も消える" do
      credential!(user: user)

      expect { user.destroy }.to change(described_class, :count).by(-1)
    end
  end

  describe "見分け" do
    it "名前を付けていれば、それを出す" do
      expect(credential!(user: user, nickname: "MacBook").display_name).to eq("MacBook")
    end

    # 複数持つと、どれがどれか分からなくなる
    it "名前が無ければ、登録した日で見分ける" do
      expect(credential!(user: user).display_name).to include("に登録した鍵")
    end
  end

  describe "使ったことの記録" do
    it "署名回数と、最後に使った時刻を残す" do
      credential = credential!(user: user)

      credential.touch_usage!(42)

      expect(credential.reload.sign_count).to eq(42)
      expect(credential.last_used_at).to be_present
    end

    # 同期する Passkey は複数の端末で使われ、数え方が実装によって違う。
    # 素朴に「増えていなければ複製」と決めつけると、正規の利用者を弾く
    it "0 のままでも受け付ける（独自の判定を足さない）" do
      credential = credential!(user: user)

      expect { credential.touch_usage!(0) }.not_to raise_error
      expect(credential.reload.sign_count).to eq(0)
    end
  end

  describe "利用者側" do
    it "鍵があれば登録済みとみなす" do
      expect(user.passkey_enrolled?).to be(false)

      credential!(user: user)

      expect(user.reload.passkey_enrolled?).to be(true)
    end

    # user handle は認証器に保存され、端末を持つ人から読めることがある。
    # 内部の利用者IDから、利用者数や登録順が推し量れる形にしない
    it "認証器へ渡す目印に、内部の利用者IDを使わない" do
      handle = user.webauthn_handle

      expect(handle).to be_present
      expect(handle).not_to eq(user.id)
    end

    it "目印は一度作ったら変わらない" do
      expect(user.webauthn_handle).to eq(user.reload.webauthn_handle)
    end

    it "利用者ごとにちがう" do
      expect(user.webauthn_handle).not_to eq(create(:user, :confirmed).webauthn_handle)
    end
  end
end
