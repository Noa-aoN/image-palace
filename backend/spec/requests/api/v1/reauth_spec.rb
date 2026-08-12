require "rails_helper"
require "webauthn/fake_client"

# 危険な操作の前の、もう一度の本人確認。
#
# **どの方法で確かめても、行き着く先は同じ**。危険操作の側は
# 「この端末が直近に確かめ済みか」だけを見て、手段を知らない。
RSpec.describe "もう一度の本人確認", type: :request do
  let(:user) { create(:user, :confirmed) }
  # devise-token-auth は端末ごとに client を配る。トークンはその client と
  # 結びついているので、勝手な値に差し替えられない（差し替えると 401 になる）。
  # 配られたものをそのまま端末の目印として使う
  let(:headers) { auth_headers_for(user) }
  let(:client_id) { headers["client"] }
  let(:origin) { WebAuthn.configuration.allowed_origins.first }
  let(:fake_client) { WebAuthn::FakeClient.new(origin) }

  before do
    @cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
  end

  after { Rails.cache = @cache }

  def enroll_totp!
    user.start_totp_enrollment!
    user.confirm_totp!(Auth::Totp.code_at(user.totp_secret))
  end

  def enroll_passkey!
    post "/api/v1/passkeys", headers: headers
    challenge = response.parsed_body.dig("options", "challenge")
    post "/api/v1/passkeys/callback",
         params: { credential: fake_client.create(challenge: challenge), challenge: challenge },
         headers: headers
  end

  describe "GET /api/v1/reauth" do
    it "まだ確かめていなければ false" do
      get "/api/v1/reauth", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["authenticated"]).to be(false)
    end

    it "使える確かめ方を返す" do
      enroll_totp!

      get "/api/v1/reauth", headers: headers

      expect(response.parsed_body["methods"]).to include("totp", "recovery_code")
    end

    it "no-store を返す" do
      get "/api/v1/reauth", headers: headers

      expect(response.headers["Cache-Control"]).to include("no-store")
    end
  end

  describe "認証アプリのコードで確かめる" do
    before { enroll_totp! }

    it "合っていれば通る" do
      post "/api/v1/reauth/code", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["authenticated"]).to be(true)
      expect(StrongAuthSession.fresh?(user: user, client_id: client_id)).to be(true)
    end

    it "合っていなければ通らない" do
      post "/api/v1/reauth/code", params: { code: "000000" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(StrongAuthSession.fresh?(user: user, client_id: client_id)).to be(false)
    end

    it "失敗も記録に残す（乗っ取りの試みは成功だけ見ていても分からない）" do
      expect { post "/api/v1/reauth/code", params: { code: "000000" }, headers: headers }
        .to change { AdminAuditLog.where(action: "strong_auth.failed").count }.by(1)
    end

    it "6桁しかないので、試行が続けば止める" do
      11.times { post "/api/v1/reauth/code", params: { code: "000000" }, headers: headers }

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "復旧コードで確かめる" do
    it "通る。どの方法で確かめても行き先は同じ" do
      codes = enroll_totp!

      post "/api/v1/reauth/code", params: { code: codes.first }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(StrongAuthSession.fresh?(user: user, client_id: client_id)).to be(true)
    end

    it "使ったことが分かるように記録する" do
      codes = enroll_totp!

      post "/api/v1/reauth/code", params: { code: codes.first }, headers: headers

      expect(StrongAuthSession.find_by(user: user, client_id: client_id).method).to eq("recovery_code")
    end

    it "一度使ったコードは二度使えない" do
      codes = enroll_totp!
      post "/api/v1/reauth/code", params: { code: codes.first }, headers: headers
      StrongAuthSession.revoke!(user: user)

      post "/api/v1/reauth/code", params: { code: codes.first }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "パスキーで確かめる" do
    before { enroll_passkey! }

    it "challenge を配る" do
      post "/api/v1/reauth/passkey/options", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("options", "challenge")).to be_present
    end

    it "署名が合えば通る" do
      post "/api/v1/reauth/passkey/options", headers: headers
      challenge = response.parsed_body.dig("options", "challenge")

      post "/api/v1/reauth/passkey",
           params: { credential: fake_client.get(challenge: challenge), challenge: challenge },
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(StrongAuthSession.find_by(user: user, client_id: client_id).method).to eq("passkey")
    end

    it "使い回した challenge では通らない" do
      post "/api/v1/reauth/passkey/options", headers: headers
      challenge = response.parsed_body.dig("options", "challenge")
      credential = fake_client.get(challenge: challenge)

      2.times do
        post "/api/v1/reauth/passkey", params: { credential: credential, challenge: challenge }, headers: headers
      end

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 画面から消すだけでは足りない
    it "栓を閉じていれば断る" do
      original = ENV["PASSKEY_ENABLED"]
      ENV["PASSKEY_ENABLED"] = "false"

      post "/api/v1/reauth/passkey/options", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    ensure
      ENV["PASSKEY_ENABLED"] = original
    end
  end

  # ここが要。片方の端末で確かめても、もう片方には効かない
  describe "端末ごとに分かれていること" do
    it "別の端末には効かない" do
      enroll_totp!
      post "/api/v1/reauth/code", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers

      # もう一度入り直すと、別の client が配られる＝別の端末
      other_device = auth_headers_for(user)
      get "/api/v1/reauth", headers: other_device

      expect(response.parsed_body["authenticated"]).to be(false)
    end
  end

  describe "危険な操作への適用" do
    let(:admin) { create(:user, :confirmed, role: "admin") }
    let(:admin_headers) { auth_headers_for(admin) }
    let(:member) { create(:user, :confirmed) }

    it "確かめていなければ、権限を変えられない" do
      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "support" }, headers: admin_headers

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["code"]).to eq("strong_auth_required")
      expect(member.reload.role).to eq("user")
    end

    # 何が使えるかを添える。画面が「どれを出すか」を決められるように
    it "断るときに、使える確かめ方を添える" do
      admin.start_totp_enrollment!
      admin.confirm_totp!(Auth::Totp.code_at(admin.totp_secret))

      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "support" }, headers: admin_headers

      expect(response.parsed_body["methods"]).to include("totp")
    end

    it "確かめていれば、権限を変えられる" do
      StrongAuthSession.record!(user: admin, client_id: admin_headers["client"], method: "passkey")

      patch "/api/v1/admin/users/#{member.id}/role", params: { role: "support" }, headers: admin_headers

      expect(response).to have_http_status(:success)
      expect(member.reload.role).to eq("support")
    end

    it "パスキーを外すにも確認が要る" do
      enroll_passkey!
      id = user.webauthn_credentials.first.id

      delete "/api/v1/passkeys/#{id}", headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(WebauthnCredential.count).to eq(1)
    end

    it "確かめていればパスキーを外せる" do
      enroll_passkey!
      StrongAuthSession.record!(user: user, client_id: client_id, method: "passkey")

      delete "/api/v1/passkeys/#{user.webauthn_credentials.first.id}", headers: headers

      expect(response).to have_http_status(:ok)
    end

    # 名前を変えるだけなら求めない（消えるものが無い）
    it "パスキーの名前を変えるだけなら確認は要らない" do
      enroll_passkey!

      patch "/api/v1/passkeys/#{user.webauthn_credentials.first.id}",
            params: { nickname: "新しい名前" }, headers: headers

      expect(response).to have_http_status(:ok)
    end
  end

  # コードを入れて確かめた直後に、もう一度同じコードを求めない
  describe "二要素の解除で、同じことを二度させないこと" do
    before { enroll_totp! }

    it "確かめていなければ外せない" do
      delete "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(user.reload.totp_enrolled?).to be(true)
    end

    it "コードで確かめたあとは、コード無しで外せる" do
      post "/api/v1/reauth/code", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers

      delete "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.totp_enrolled?).to be(false)
    end
  end

  describe "まだ必須にしていないこと" do
    it "確かめていない運営でも、これまでどおり運営の入口に入れる" do
      admin = create(:user, :confirmed, role: "admin")

      get "/api/v1/admin/overview", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
    end
  end
end
