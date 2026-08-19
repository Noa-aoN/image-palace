# frozen_string_literal: true

require "rails_helper"

# 認証の応答に、渡してはいけないものが混ざっていないか。
#
# devise_token_auth の既定は「除くものを並べる」形（`as_json(except: ...)`）で、
# **列を足すたびに、それがそのまま画面へ流れる。**
#
# 実際、二要素認証の秘密鍵と復旧コードが平文で返っていた。
# トークンは localStorage に置いているので、XSS ひとつで
# 入る鍵と二要素の鍵が同時に渡り、二要素が二要素でなくなる。
#
# ここは「出してよいものだけ」を数え上げて見張る。
# 列を足しても、明示しない限り応答には出ない。
RSpec.describe "認証の応答に載る項目", type: :request do
  # 渡ったら困るもの。**新しく危ないものが増えたらここへ足す**
  FORBIDDEN = %w[
    totp_secret totp_recovery_codes totp_confirmed_at
    stripe_customer_id stripe_reconciled_at
    subscription_credits topup_credits credits_period_start
    trial_granted_at webauthn_id reauthenticated_at
    encrypted_password tokens
  ].freeze

  let(:password) { "password123" }

  # 危ないものを一通り持っている状態にする
  let(:user) do
    create(:user, :confirmed).tap do |u|
      u.update!(
        totp_secret: "JBSWY3DPEHPK3PXP",
        totp_recovery_codes: %w[aaa-111 bbb-222],
        totp_confirmed_at: Time.current,
        stripe_customer_id: "cus_test123"
      )
    end
  end

  def user_json
    body = JSON.parse(response.body)
    body["data"] || body
  end

  def expect_no_secrets(json)
    leaked = FORBIDDEN & json.keys
    expect(leaked).to be_empty, "応答に #{leaked.join(', ')} が載っている"
  end

  describe "ログイン（POST /api/v1/auth/sign_in）" do
    before { post "/api/v1/auth/sign_in", params: { email: user.email, password: password }, as: :json }

    it "秘密を渡さない" do
      expect(response).to have_http_status(:success)
      expect_no_secrets(user_json)
    end

    # ここが一番大事。二要素の鍵は、持っている本人にも応答で返す必要が無い
    it "二要素の秘密鍵と復旧コードを渡さない" do
      expect(user_json).not_to have_key("totp_secret")
      expect(user_json).not_to have_key("totp_recovery_codes")
      expect(response.body).not_to include("JBSWY3DPEHPK3PXP")
    end

    # 画面が使うものは残っていること（絞りすぎて壊さない）
    it "画面が使う項目は残る" do
      expect(user_json).to include("id", "uid", "email", "name", "provider", "role")
    end
  end

  describe "トークンの確認（GET /api/v1/auth/validate_token）" do
    it "秘密を渡さない" do
      get "/api/v1/auth/validate_token", headers: user.create_new_auth_token, as: :json

      expect(response).to have_http_status(:success)
      expect_no_secrets(user_json)
    end
  end

  describe "新規登録（POST /api/v1/auth）" do
    it "秘密を渡さない" do
      post "/api/v1/auth", params: {
        email: "fields-#{SecureRandom.hex(4)}@example.com",
        password: password, password_confirmation: password
      }, as: :json

      expect(response).to have_http_status(:success)
      expect_no_secrets(user_json)
    end
  end

  describe "パスワードの変更（PUT /api/v1/auth/password）" do
    it "秘密を渡さない" do
      user.update!(allow_password_change: true)

      put "/api/v1/auth/password",
          params: { password: "new-password-123", password_confirmation: "new-password-123" },
          headers: user.create_new_auth_token, as: :json

      expect(response).to have_http_status(:success)
      expect_no_secrets(user_json)
    end
  end

  # 応答の形を決めているのはモデル側なので、そこも直に見る
  describe "User#token_validation_response" do
    it "数え上げた項目しか返さない" do
      expect(user.token_validation_response.keys).to match_array(User::PUBLIC_ATTRIBUTES)
    end

    # 列を足したときに、黙って漏れる側へ入らないこと
    it "新しい列は既定で出ない" do
      all_columns = User.column_names
      exposed = user.token_validation_response.keys

      expect(all_columns - exposed).to include("totp_secret", "stripe_customer_id")
    end
  end
end
