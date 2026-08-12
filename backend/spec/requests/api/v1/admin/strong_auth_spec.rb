require "rails_helper"

# 運営として入るには、一次認証（パスワード・Google・Apple）に加えて
# もう一度ご本人か確かめる。
#
# **合鍵ひとつで執務室まで開くのを避ける。**
# ただし段階的に入れるものなので、栓ひとつで元へ戻せることを何より確かめる。
RSpec.describe "運営の入口での強い確認", type: :request do
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:headers) { auth_headers_for(admin) }
  let(:client_id) { headers["client"] }

  def require_strong_auth(enabled)
    allow(Auth::StrongAuth).to receive(:admin_required?).and_return(enabled)
  end

  # ここが最も大事。作りかけでも事故でも、栓ひとつで元の姿へ戻せる
  describe "まだ求めない設定のとき（既定）" do
    before { require_strong_auth(false) }

    it "これまでどおり入れる" do
      get "/api/v1/admin/overview", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "手立てを何も持っていなくても入れる" do
      expect(Auth::StrongAuth.prepared?(admin)).to be(false)

      get "/api/v1/admin/audit_logs", headers: headers

      expect(response).to have_http_status(:ok)
    end
  end

  describe "求める設定のとき" do
    before { require_strong_auth(true) }

    context "手立てを持っている人" do
      before { admin.update!(totp_secret: Auth::Totp.generate_secret, totp_confirmed_at: Time.current) }

      it "確かめる前は断る" do
        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["code"]).to eq("strong_auth_required")
      end

      # 何で確かめられるのか分からないと、利用者は次の一手を選べない
      it "何が使えるかを添えて断る" do
        get "/api/v1/admin/overview", headers: headers

        expect(response.parsed_body["methods"]).to include("totp")
      end

      it "確かめたあとは入れる" do
        StrongAuthSession.record!(user: admin, client_id: client_id, method: "totp")

        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:ok)
      end

      # 置き忘れた携帯で執務室が開いてはいけない
      it "別の端末で確かめても、この端末は開かない" do
        StrongAuthSession.record!(user: admin, client_id: "別の端末", method: "passkey")

        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      it "猶予を過ぎたら再び求める" do
        session = StrongAuthSession.record!(user: admin, client_id: client_id, method: "totp")
        session.update!(authenticated_at: (StrongAuthSession::ADMIN_WINDOW + 1.minute).ago)

        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      # 読んで回るだけの時間で追い出されると、確かめ直しが作業の邪魔にしかならない。
      # 執務室に居ること自体は、それだけでは何も壊さない
      it "危険操作の猶予（10分）を過ぎても、執務室には居られる" do
        session = StrongAuthSession.record!(user: admin, client_id: client_id, method: "totp")
        session.update!(authenticated_at: 20.minutes.ago)

        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:success)
      end

      # ここが要。窓を広げたのは「入口」だけで、中の危険操作は短いまま
      it "執務室には居られても、役割の変更には確かめ直しを求める" do
        admin.update!(role: "admin")
        session = StrongAuthSession.record!(user: admin, client_id: client_id, method: "totp")
        session.update!(authenticated_at: 20.minutes.ago)
        target = create(:user, :confirmed)

        patch "/api/v1/admin/users/#{target.id}/role", params: { role: "support" }, headers: headers

        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["code"]).to eq("strong_auth_required")
        expect(target.reload.role).to eq("user")
      end
    end

    # 締め出さない。ただし黙って通しもしない
    context "手立てを何も持っていない人" do
      it "用意してほしいと伝えて断る" do
        get "/api/v1/admin/overview", headers: headers

        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["code"]).to eq("strong_auth_setup_required")
      end

      # ここを通してしまうと、それは恒久的な抜け道になる
      it "手立てが無いことを理由に通しはしない" do
        get "/api/v1/admin/users", headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      # 執務室の外は変わらず開く。自分で用意して戻ってこられる
      it "アカウントの設定は開く（自分で用意して戻ってこられる）" do
        get "/api/v1/reauth", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "ふだんの機能は変わらず使える" do
        get "/api/v1/items", headers: headers

        expect(response).to have_http_status(:ok)
      end
    end

    # 入口の案内板まで閉めると、何をすればよいか分からなくなる
    describe "入口の案内" do
      it "権限と、いまの状態を返す" do
        get "/api/v1/admin/session", headers: headers

        expect(response).to have_http_status(:ok)
        strong_auth = response.parsed_body["strong_auth"]
        expect(strong_auth).to include("required" => true, "satisfied" => false, "prepared" => false)
      end

      it "確かめたあとは通ったと分かる" do
        admin.update!(totp_secret: Auth::Totp.generate_secret, totp_confirmed_at: Time.current)
        StrongAuthSession.record!(user: admin, client_id: client_id, method: "totp")

        get "/api/v1/admin/session", headers: headers

        expect(response.parsed_body["strong_auth"]).to include("satisfied" => true, "prepared" => true)
      end
    end

    # 権限が無い人には、強い確認の話をする前に断る（運営の存在を匂わせない）
    it "運営でない人には権限の話だけを返す" do
      general = create(:user, :confirmed)

      get "/api/v1/admin/overview", headers: auth_headers_for(general)

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["code"]).to be_nil
    end
  end
end
