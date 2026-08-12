require "rails_helper"

RSpec.describe "二要素認証", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  # 試行回数の数え上げに Rails.cache を使う。test では :null_store で書いても読めない
  before do
    @cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
  end

  after { Rails.cache = @cache }

  describe "GET /api/v1/totp" do
    it "設定していなければ enrolled: false" do
      get "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["enrolled"]).to be(false)
    end

    it "認証が要る" do
      get "/api/v1/totp"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/totp（登録の始め）" do
    it "秘密鍵と、認証アプリへ渡す URI を返す" do
      post "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["secret"]).to match(/\A[A-Z2-7]+\z/)
      expect(response.parsed_body["provisioning_uri"]).to start_with("otpauth://totp/")
    end

    # 鍵を作った時点で有効にすると、認証アプリへの登録に失敗した人が締め出される
    it "この時点ではまだ有効にしない" do
      post "/api/v1/totp", headers: headers

      expect(user.reload.totp_enrolled?).to be(false)
    end
  end

  describe "POST /api/v1/totp/confirm" do
    before { post "/api/v1/totp", headers: headers }

    it "コードが合えば有効になり、復旧コードを返す" do
      code = Auth::Totp.code_at(user.reload.totp_secret)

      post "/api/v1/totp/confirm", params: { code: code }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["recovery_codes"].size).to eq(User::TOTP_RECOVERY_CODE_COUNT)
      expect(user.reload.totp_enrolled?).to be(true)
    end

    it "コードが違えば断る" do
      post "/api/v1/totp/confirm", params: { code: "000000" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.totp_enrolled?).to be(false)
    end

    # 6桁しかない。総当たりを許さない
    it "試行が続くと止める" do
      (User::TOTP_RECOVERY_CODE_COUNT + 1).times do
        post "/api/v1/totp/confirm", params: { code: "000000" }, headers: headers
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "DELETE /api/v1/totp（解除）" do
    before do
      post "/api/v1/totp", headers: headers
      post "/api/v1/totp/confirm", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers
    end

    # 端末を置き忘れた隙に外されると、二要素の意味がなくなる
    it "コードが無ければ外せない" do
      delete "/api/v1/totp", params: { code: "000000" }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.totp_enrolled?).to be(true)
    end

    it "コードが合えば外せる" do
      delete "/api/v1/totp", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.totp_enrolled?).to be(false)
    end

    it "外したことを記録に残す" do
      expect {
        delete "/api/v1/totp", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers
      }.to change { AdminAuditLog.where(action: "totp.disabled").count }.by(1)
    end
  end

  # まだ必須にしない。設定していなくても運営の入口には入れる
  describe "必須化していないこと" do
    it "二要素を設定していない運営でも /admin に入れる" do
      admin = create(:user, :confirmed, role: "admin")

      get "/api/v1/admin/overview", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
    end
  end
end
