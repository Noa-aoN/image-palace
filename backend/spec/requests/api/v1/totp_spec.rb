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

    # 端末を置き忘れた隙に外されると、二要素の意味がなくなる。
    # 確かめ方は共通の口（/reauth）に寄せてある
    it "確かめていなければ外せない" do
      # 設定した直後は、その端末を確かめ済みとして扱っている。
      # 「確かめていない状態」を作るために、いったん取り消す
      StrongAuthSession.revoke!(user: user)

      delete "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(user.reload.totp_enrolled?).to be(true)
    end

    it "確かめていれば外せる" do
      StrongAuthSession.record!(user: user, client_id: headers["client"], method: "totp")

      delete "/api/v1/totp", headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload.totp_enrolled?).to be(false)
    end

    it "外したことを記録に残す" do
      StrongAuthSession.record!(user: user, client_id: headers["client"], method: "totp")

      expect { delete "/api/v1/totp", headers: headers }
        .to change { AdminAuditLog.where(action: "totp.disabled").count }.by(1)
    end
  end

  # 控えを失くした・人に見られたかもしれない、というときの配り直し。
  # **配り直した時点で、前のコードはすべて使えなくなる**
  describe "POST /api/v1/totp/regenerate_recovery_codes（配り直し）" do
    let!(:first_codes) do
      post "/api/v1/totp", headers: headers
      post "/api/v1/totp/confirm", params: { code: Auth::Totp.code_at(user.reload.totp_secret) }, headers: headers
      response.parsed_body["recovery_codes"]
    end

    def regenerate
      StrongAuthSession.record!(user: user, client_id: headers["client"], method: "totp")
      post "/api/v1/totp/regenerate_recovery_codes", headers: headers
    end

    it "新しいコードを同じ本数だけ配る" do
      regenerate

      expect(response).to have_http_status(:ok)
      codes = response.parsed_body["recovery_codes"]
      expect(codes.size).to eq(User::TOTP_RECOVERY_CODE_COUNT)
      expect(codes).not_to match_array(first_codes)
    end

    # ここが要。古いものが生き残っていては配り直す意味がない
    it "前のコードは使えなくなる" do
      regenerate

      expect(user.reload.verify_totp(first_codes.first)).to be(false)
    end

    it "新しいコードは使える" do
      regenerate
      new_code = response.parsed_body["recovery_codes"].first

      expect(user.reload.verify_totp(new_code)).to be(true)
    end

    # 乗っ取った人が、失くしていない人の備えを勝手に差し替えられては困る
    it "確かめていなければ配り直せない" do
      StrongAuthSession.revoke!(user: user)

      post "/api/v1/totp/regenerate_recovery_codes", headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(user.reload.verify_totp(first_codes.first)).to be(true)
    end

    it "配り直したことを記録に残す" do
      expect { regenerate }
        .to change { AdminAuditLog.where(action: "totp.recovery_codes_regenerated").count }.by(1)
    end

    it "認証アプリの鍵は変えない（登録し直させない）" do
      before_secret = user.reload.totp_secret

      regenerate

      expect(user.reload.totp_secret).to eq(before_secret)
    end

    it "二要素を設定していない人には配らない" do
      other = create(:user, :confirmed)
      other_headers = auth_headers_for(other)
      StrongAuthSession.record!(user: other, client_id: other_headers["client"], method: "totp")

      post "/api/v1/totp/regenerate_recovery_codes", headers: other_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "溜めさせない" do
      regenerate

      expect(response.headers["Cache-Control"]).to include("no-store")
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

  # 秘密鍵と復旧コードが通る経路。どこにも溜めさせない
  describe "キャッシュさせない" do
    it "no-store を返す" do
      get "/api/v1/totp", headers: headers

      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    # 認証で弾かれた応答にも同じ扱いを掛ける（経路ごと揃えておくほうが穴が無い）
    it "認証されていない応答でも no-store を返す" do
      get "/api/v1/totp"

      expect(response).to have_http_status(:unauthorized)
      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    it "登録の始めでも no-store を返す" do
      post "/api/v1/totp", headers: headers

      expect(response.headers["Cache-Control"]).to include("no-store")
    end
  end
end
