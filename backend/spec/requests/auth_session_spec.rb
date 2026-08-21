# frozen_string_literal: true

require "rails_helper"

# 認証と、一時的なセッションの寿命。
#
# **種類が増えた。** 通常ログイン・工房のアカウント・強い確認・パスキー/TOTP・
# 体験の宮殿・下見。それぞれ寿命の決まり方が違う。
#
# ここは「いまどうなっているか」を写し取る場所。
# 決まりを変えるときは、まずここが落ちる。
RSpec.describe "認証と一時セッションの寿命", type: :request do
  let(:password) { "aA1!#{SecureRandom.hex(8)}" }
  let!(:user) do
    create(:user, :confirmed, password: password, password_confirmation: password)
  end

  # ── 1. 通常ログイン ────────────────────────
  describe "通常ログインの寿命" do
    it "7日で切れる（環境変数で変えられる）" do
      expect(DeviseTokenAuth.token_lifespan).to eq(7.days)

      headers = user.create_new_auth_token

      expect(Time.zone.at(headers["expiry"].to_i)).to be_within(1.minute).of(7.days.from_now)
    end

    # **使っている限り切れない。** 毎回付け替えるので、期限も伸びる
    it "使うたびに期限が伸びる" do
      headers = user.create_new_auth_token
      first = headers["expiry"].to_i

      travel_to(1.hour.from_now) do
        get "/api/v1/items", headers: headers, as: :json

        expect(response).to have_http_status(:success)
        expect(response.headers["expiry"].to_i).to be > first
      end
    end

    it "6日ぶりでも入れる" do
      headers = user.create_new_auth_token

      travel_to(6.days.from_now) do
        get "/api/v1/items", headers: headers, as: :json
        expect(response).to have_http_status(:success)
      end
    end

    # **放置すれば切れる。** ここが「有効期限」の実体
    it "8日ぶりだと切れている" do
      headers = user.create_new_auth_token

      travel_to(8.days.from_now) do
        get "/api/v1/items", headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "同時に持てる端末は10まで" do
      expect(DeviseTokenAuth.max_number_of_devices).to eq(10)
    end

    # 複数のタブが同時に叩くと、片方が古いトークンを持つ。
    # **猶予があるので、その間は古いほうも通る**
    it "付け替えの猶予がある（複数タブが同時に叩いても落ちない）" do
      expect(DeviseTokenAuth.batch_request_buffer_throttle).to eq(5.seconds)

      headers = user.create_new_auth_token
      get "/api/v1/items", headers: headers, as: :json
      expect(response).to have_http_status(:success)

      # 同じ（古い）トークンでもう一度。猶予の内側なので通る
      get "/api/v1/items", headers: headers, as: :json
      expect(response).to have_http_status(:success)
    end
  end

  # ── 2. 期限切れを直に送る ──────────────────
  describe "期限切れのトークンを直にAPIへ送る" do
    it "401 で断る（中身は返さない）" do
      headers = user.create_new_auth_token

      travel_to(8.days.from_now) do
        get "/api/v1/items", headers: headers, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(response.body).not_to include("items")
      end
    end

    it "でたらめなトークンも 401" do
      get "/api/v1/items",
          headers: { "access-token" => "nonsense", "client" => "x", "uid" => user.email },
          as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # **時計のずれは効かない。** 期限は数値でサーバー側だけが見る
    it "画面が送ってくる expiry は見ていない（時計をずらしても通らない）" do
      headers = user.create_new_auth_token

      travel_to(8.days.from_now) do
        get "/api/v1/items", headers: headers.merge("expiry" => 10.years.from_now.to_i.to_s), as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  # ── 3. ログアウト ─────────────────────────
  describe "ログアウトのあと" do
    it "そのトークンは使えなくなる" do
      headers = user.create_new_auth_token

      delete "/api/v1/auth/sign_out", headers: headers, as: :json
      expect(response).to have_http_status(:success)

      get "/api/v1/items", headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    # **その端末だけ。** ほかの端末は使えたまま
    it "ほかの端末は使えたまま" do
      phone = user.create_new_auth_token
      laptop = user.reload.create_new_auth_token

      delete "/api/v1/auth/sign_out", headers: phone, as: :json

      get "/api/v1/items", headers: laptop, as: :json
      expect(response).to have_http_status(:success)
    end
  end

  # ── 4. 退会 ──────────────────────────────
  describe "退会のあと" do
    it "そのトークンは使えなくなる" do
      headers = user.create_new_auth_token

      delete "/api/v1/account", headers: headers, as: :json
      expect(response).to have_http_status(:no_content)

      get "/api/v1/items", headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "強い確認の記録も残らない" do
      headers = user.create_new_auth_token
      StrongAuthSession.record!(user: user, client_id: headers["client"], method: "passkey")
      # **空振りで通らないように、消える前にあることを確かめる**
      expect(StrongAuthSession.where(user_id: user.id).count).to eq(1)

      delete "/api/v1/account", headers: headers, as: :json

      expect(StrongAuthSession.where(user_id: user.id)).to be_empty
    end
  end

  # ── 合言葉を変えたあと ────────────────────
  #
  # **いまは、変えても前のトークンが生き続ける。**
  # 「他人に使われているかもしれないから変える」場面で、
  # その他人を追い出せない。仕様として意識して置いてある値なので、
  # 変えるときはここが落ちる
  describe "合言葉を変えたあと" do
    let(:new_password) { "bB2@#{SecureRandom.hex(8)}" }

    it "いまの合言葉を知らないと変えられない" do
      expect(DeviseTokenAuth.check_current_password_before_update).to eq(:password)

      headers = user.create_new_auth_token
      put "/api/v1/auth/password",
          params: { password: new_password, password_confirmation: new_password },
          headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "いまの合言葉を添えれば変えられる" do
      headers = user.create_new_auth_token
      put "/api/v1/auth/password",
          params: { current_password: password, password: new_password,
                    password_confirmation: new_password },
          headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(user.reload.valid_password?(new_password)).to be(true)
    end

    # **ここが穴。** 変えても、ほかの端末のトークンは生きている
    it "ほかの端末のトークンは、いまは生き続ける" do
      other = user.create_new_auth_token
      mine = user.reload.create_new_auth_token

      put "/api/v1/auth/password",
          params: { current_password: password, password: new_password,
                    password_confirmation: new_password },
          headers: mine, as: :json
      expect(response).to have_http_status(:success)

      get "/api/v1/items", headers: other, as: :json

      expect(response).to have_http_status(:success)
      expect(DeviseTokenAuth.remove_tokens_after_password_reset).to be(false)
    end

    # 強い確認の記録も残る（端末ごとなので、その端末では窓が開いたまま）
    it "強い確認の記録も残る" do
      headers = user.create_new_auth_token
      StrongAuthSession.record!(user: user, client_id: headers["client"], method: "passkey")

      put "/api/v1/auth/password",
          params: { current_password: password, password: new_password,
                    password_confirmation: new_password },
          headers: headers, as: :json

      expect(StrongAuthSession.fresh?(user: user, client_id: headers["client"])).to be(true)
    end
  end

  # ── 5. 強い確認 ──────────────────────────
  #
  # **端末ごと。** 合鍵1つで全部が開かないように、client 単位で持つ
  describe "強い確認" do
    let(:headers) { user.create_new_auth_token }
    let(:client) { headers["client"] }

    it "窓は2つある（ふつう10分 / 執務室・工房室は1時間）" do
      expect(StrongAuthSession::WINDOW).to eq(10.minutes)
      expect(StrongAuthSession::ADMIN_WINDOW).to eq(1.hour)
    end

    it "確かめた直後は新しい" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      expect(StrongAuthSession.fresh?(user: user, client_id: client)).to be(true)
    end

    it "10分を過ぎるとふつうの窓は閉じる" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      travel_to(11.minutes.from_now) do
        expect(StrongAuthSession.fresh?(user: user, client_id: client)).to be(false)
      end
    end

    it "執務室・工房室の窓は1時間開いている" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      travel_to(59.minutes.from_now) do
        expect(StrongAuthSession.fresh?(user: user, client_id: client,
                                        within: StrongAuthSession::ADMIN_WINDOW)).to be(true)
      end
      travel_to(61.minutes.from_now) do
        expect(StrongAuthSession.fresh?(user: user, client_id: client,
                                        within: StrongAuthSession::ADMIN_WINDOW)).to be(false)
      end
    end

    # **もう一度確かめれば、窓は開き直す**
    it "パスキー・認証アプリで確かめ直すと、窓が開き直る" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      travel_to(30.minutes.from_now) do
        StrongAuthSession.record!(user: user, client_id: client, method: "totp")

        expect(StrongAuthSession.fresh?(user: user, client_id: client)).to be(true)
      end
    end

    # **端末をまたがない。** 別のタブ（別の client）では開かない
    it "別の端末では開かない" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      expect(StrongAuthSession.fresh?(user: user, client_id: "other-client")).to be(false)
    end

    it "確かめた記録は1日で片付く" do
      StrongAuthSession.record!(user: user, client_id: client, method: "passkey")

      travel_to(2.days.from_now) { StrongAuthSession.sweep! }

      expect(StrongAuthSession.where(user_id: user.id)).to be_empty
    end
  end

  # ── 工房のアカウント ───────────────────────────
  #
  # **特別扱いしない。** 権限が広いだけで、ログインの寿命は同じ。
  # 奥の部屋は「強い確認」で守る（そちらは10分/1時間の窓）
  describe "工房のアカウント" do
    let(:official) { create(:user, :confirmed, email: "studio@example.com") }

    around do |example|
      original = ENV["OFFICIAL_CONTENT_USER_ID"]
      ENV["OFFICIAL_CONTENT_USER_ID"] = official.id
      example.run
      ENV["OFFICIAL_CONTENT_USER_ID"] = original
    end

    it "ログインの寿命は、ふつうの人と同じ" do
      headers = official.create_new_auth_token

      expect(Time.zone.at(headers["expiry"].to_i)).to be_within(1.minute).of(7.days.from_now)
    end

    it "8日ぶりだと、工房室にも入れない" do
      headers = official.create_new_auth_token

      travel_to(8.days.from_now) do
        get "/api/v1/admin/studio", headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  # ── 体験の宮殿が片付いたあと ────────────────
  #
  # 宮殿は2時間で消えるが、トークンの寿命は7日。
  # **アカウントごと消えるので、トークンも一緒に効かなくなる**
  describe "体験の宮殿が片付いたあと" do
    it "そのトークンは使えなくなる" do
      demo = create(:user, :confirmed, email: "demo-#{SecureRandom.hex(4)}@#{User::DEMO_EMAIL_DOMAIN}")
      headers = demo.create_new_auth_token

      get "/api/v1/items", headers: headers, as: :json
      expect(response).to have_http_status(:success)

      travel_to((Demo::Session::LIFETIME + 1.minute).from_now) do
        Demo::Session.sweep!

        get "/api/v1/items", headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  # ── 6. 体験の合鍵 ────────────────────────
  describe "体験の宮殿の合鍵" do
    it "宮殿と同じ寿命（2時間）" do
      expect(Demo::Session::LIFETIME).to eq(2.hours)
    end

    it "署名があるので、他人の宮殿を指すものは作れない" do
      expect(Demo::Session.user_from_resume_token("fake")).to be_nil
      expect(Demo::Session.user_from_resume_token(nil)).to be_nil
    end

    it "寿命が切れた合鍵は通らない" do
      token = Demo::Session.resume_token_for(user)

      expect(Demo::Session.user_from_resume_token(token)).to eq(user.id)

      travel_to((Demo::Session::LIFETIME + 1.minute).from_now) do
        expect(Demo::Session.user_from_resume_token(token)).to be_nil
      end
    end
  end

  # ── 7. 下見 ──────────────────────────────
  describe "下見" do
    it "体験の宮殿と同じ寿命（2時間）" do
      expect(Studio::Preview::LIFETIME).to eq(2.hours)
    end

    # **合鍵では持たない。** サーバー側の行なので、画面から偽れない
    it "合鍵ではなく、サーバー側の行で持つ" do
      expect(Studio::Preview.current(user)).to be_nil

      ContentInstallation.create!(user: user, package_key: "k", package_version: 1,
                                  source: "preview", installed_at: Time.current)

      expect(Studio::Preview.current(user)).to be_present
    end

    it "寿命が切れたら、見ていないことになる" do
      ContentInstallation.create!(user: user, package_key: "k", package_version: 1,
                                  source: "preview", installed_at: Time.current)

      travel_to((Studio::Preview::LIFETIME + 1.minute).from_now) do
        expect(Studio::Preview.current(user)).to be_nil
      end
    end
  end
end
