require "rails_helper"
# 擬似認証器。本物と同じ形の応答を作る（gem が試験用に持っている）
require "webauthn/fake_client"

# Passkey の登録と管理。
#
# 認証器そのものは動かせないので、gem が用意している擬似認証器
# （WebAuthn::FakeClient）で本物と同じ形の応答を作って確かめる。
RSpec.describe "Passkey", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:origin) { WebAuthn.configuration.allowed_origins.first }
  let(:fake_client) { WebAuthn::FakeClient.new(origin) }

  def with_env(key, value)
    original = ENV[key]
    ENV[key] = value
    yield
  ensure
    ENV[key] = original
  end

  # 登録を最後まで通す。返り値は作った鍵
  def register!(nickname: nil)
    post "/api/v1/passkeys", headers: headers
    challenge = response.parsed_body.dig("options", "challenge")
    credential = fake_client.create(challenge: challenge)

    post "/api/v1/passkeys/callback",
         params: { credential: credential, challenge: challenge, nickname: nickname },
         headers: headers
    response.parsed_body["credential"]
  end

  describe "GET /api/v1/passkeys" do
    it "登録していなければ空" do
      get "/api/v1/passkeys", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["credentials"]).to eq([])
    end

    it "認証が要る" do
      get "/api/v1/passkeys"

      expect(response).to have_http_status(:unauthorized)
    end

    # 秘密が通る経路。どこにも溜めさせない
    it "no-store を返す" do
      get "/api/v1/passkeys", headers: headers

      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    it "認証されていない応答でも no-store を返す" do
      get "/api/v1/passkeys"

      expect(response.headers["Cache-Control"]).to include("no-store")
    end
  end

  describe "登録" do
    it "指示と challenge を返す" do
      post "/api/v1/passkeys", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("options", "challenge")).to be_present
      expect(response.parsed_body.dig("options", "rp", "id")).to eq(WebAuthn.configuration.rp_id)
    end

    # 鍵を作った時点では保存しない。作れたかどうかは次で確かめる
    it "指示を出しただけでは登録されない" do
      expect { post "/api/v1/passkeys", headers: headers }.not_to change(WebauthnCredential, :count)
    end

    it "認証器が作った鍵を保存する" do
      expect { register!(nickname: "MacBook") }.to change(WebauthnCredential, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("credential", "nickname")).to eq("MacBook")
    end

    it "登録を記録に残す" do
      expect { register! }.to change { AdminAuditLog.where(action: "passkey.registered").count }.by(1)
    end

    # 1本だと、その端末を失った時点で入れなくなる
    it "何本でも登録できる" do
      register!(nickname: "1本目")
      register!(nickname: "2本目")

      expect(user.reload.webauthn_credentials.count).to eq(2)
    end

    # 同じ認証器で二重に作らせない
    it "登録済みの鍵を除外の一覧に載せる" do
      register!
      post "/api/v1/passkeys", headers: headers

      expect(response.parsed_body.dig("options", "excludeCredentials")).to be_present
    end

    it "challenge が違えば断る" do
      post "/api/v1/passkeys", headers: headers
      challenge = response.parsed_body.dig("options", "challenge")
      credential = fake_client.create(challenge: challenge)

      post "/api/v1/passkeys/callback",
           params: { credential: credential, challenge: WebauthnChallenge.generate_challenge },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(WebauthnCredential.count).to eq(0)
    end

    # 使い回せると、盗み見た応答をそのまま送り直せる
    it "同じ challenge は二度使えない" do
      post "/api/v1/passkeys", headers: headers
      challenge = response.parsed_body.dig("options", "challenge")
      credential = fake_client.create(challenge: challenge)

      2.times do
        post "/api/v1/passkeys/callback", params: { credential: credential, challenge: challenge }, headers: headers
      end

      expect(response).to have_http_status(:unprocessable_entity)
      expect(WebauthnCredential.count).to eq(1)
    end

    it "認証が要る" do
      post "/api/v1/passkeys"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "名前を変える" do
    it "付け直せる" do
      created = register!(nickname: "古い名前")

      patch "/api/v1/passkeys/#{created['id']}", params: { nickname: "新しい名前" }, headers: headers

      expect(response.parsed_body.dig("credential", "nickname")).to eq("新しい名前")
    end

    it "他人の鍵は触れない" do
      created = register!
      other = create(:user, :confirmed)

      patch "/api/v1/passkeys/#{created['id']}", params: { nickname: "乗っ取り" },
                                                 headers: auth_headers_for(other)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "外す" do
    it "外せる" do
      created = register!

      expect { delete "/api/v1/passkeys/#{created['id']}", headers: headers }
        .to change(WebauthnCredential, :count).by(-1)
    end

    it "外したことを記録に残す" do
      created = register!

      expect { delete "/api/v1/passkeys/#{created['id']}", headers: headers }
        .to change { AdminAuditLog.where(action: "passkey.removed").count }.by(1)
    end

    # 残せないと、機種変更のときに古い鍵を消せない。
    # 締め出しは認証アプリ・復旧コード・rake task で防ぐ
    it "最後の1本でも外せる" do
      created = register!

      delete "/api/v1/passkeys/#{created['id']}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.passkey_enrolled?).to be(false)
    end

    it "他人の鍵は外せない" do
      created = register!
      other = create(:user, :confirmed)

      delete "/api/v1/passkeys/#{created['id']}", headers: auth_headers_for(other)

      expect(response).to have_http_status(:not_found)
      expect(WebauthnCredential.count).to eq(1)
    end
  end

  # 画面から消すだけでは足りない。API を直に叩けば通ってしまう
  describe "栓を閉じたとき" do
    it "一覧も登録も断る" do
      with_env("PASSKEY_ENABLED", "false") do
        get "/api/v1/passkeys", headers: headers
        expect(response).to have_http_status(:service_unavailable)

        post "/api/v1/passkeys", headers: headers
        expect(response).to have_http_status(:service_unavailable)
      end
    end

    it "登録済みの鍵は消さない（また入にしたとき使える）" do
      register!

      with_env("PASSKEY_ENABLED", "false") do
        get "/api/v1/passkeys", headers: headers
      end

      expect(user.reload.webauthn_credentials.count).to eq(1)
    end

    # Passkey を止めても、認証アプリは使えなければならない
    it "二要素認証には影響しない" do
      with_env("PASSKEY_ENABLED", "false") do
        get "/api/v1/totp", headers: headers

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
