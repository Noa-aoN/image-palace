require "rails_helper"

RSpec.describe "Api::V1::Settings", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  describe "GET /api/v1/settings" do
    it "認証なしでは 401" do
      get "/api/v1/settings", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "設定が無ければ既定値で作成して返す（生成オプションは既定ON）" do
      get "/api/v1/settings", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_meanings"]).to be(true)
      expect(json_response["auto_generate_tags"]).to be(true)
      expect(json_response).to have_key("default_image_style")
      expect(user.reload.setting).to be_present
    end
  end

  describe "PATCH /api/v1/settings" do
    it "意味の自動生成設定を更新する" do
      patch "/api/v1/settings", params: { setting: { auto_generate_meanings: true } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_meanings"]).to be(true)
      expect(user.reload.setting.auto_generate_meanings).to be(true)
    end

    it "タグの自動生成設定を更新する" do
      patch "/api/v1/settings", params: { setting: { auto_generate_tags: true } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["auto_generate_tags"]).to be(true)
      expect(user.reload.setting.auto_generate_tags).to be(true)
    end

    it "デフォルト画像スタイルを更新する" do
      patch "/api/v1/settings", params: { setting: { default_image_style: "watercolor" } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["default_image_style"]).to eq("watercolor")
      expect(user.reload.setting.default_image_style).to eq("watercolor")
    end

    it "不正なデフォルト画像スタイルは 422 を返す" do
      patch "/api/v1/settings", params: { setting: { default_image_style: "bogus" } }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "再生成で意味を参考にする既定は OFF で、ON に更新できる" do
      get "/api/v1/settings", headers: headers
      expect(json_response["regenerate_with_meaning"]).to be(false)

      patch "/api/v1/settings", params: { setting: { regenerate_with_meaning: true } }, headers: headers
      expect(response).to have_http_status(:success)
      expect(json_response["regenerate_with_meaning"]).to be(true)
      expect(user.reload.setting.regenerate_with_meaning).to be(true)
    end

    it "図の表現とアニメーションの既定は 3d / auto で、更新できる" do
      get "/api/v1/settings", headers: headers
      expect(json_response["diagram_mode"]).to eq("3d")
      expect(json_response["motion_mode"]).to eq("auto")

      patch "/api/v1/settings", params: { setting: { diagram_mode: "2d", motion_mode: "off" } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["diagram_mode"]).to eq("2d")
      expect(json_response["motion_mode"]).to eq("off")
      expect(user.reload.setting.diagram_mode).to eq("2d")
      expect(user.setting.motion_mode).to eq("off")
    end

    it "不正な図の表現・アニメーション設定は 422 を返す" do
      patch "/api/v1/settings", params: { setting: { diagram_mode: "4d" } }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)

      patch "/api/v1/settings", params: { setting: { motion_mode: "bogus" } }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "ライブラリの棚の並び順" do
    it "未設定でも既定の順を返す" do
      get "/api/v1/settings", headers: headers
      expect(json_response["library_order"]).to eq(Setting::LIBRARY_SECTIONS)
    end

    it "並び順を保存でき、載っていない棚は末尾に回る" do
      patch "/api/v1/settings", params: { setting: { library_order: %w[spaces cards] } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["library_order"]).to eq(%w[spaces cards canvas boxes materials])
      expect(user.reload.setting.library_order).to eq(%w[spaces cards canvas boxes materials])
    end

    it "知らない名前を混ぜても壊れない" do
      patch "/api/v1/settings", params: { setting: { library_order: %w[bogus boxes] } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["library_order"]).to eq(%w[boxes cards canvas spaces materials])
    end
  end

  # 指を乗せたときの説明。**慣れた人には邪魔になるので切れる。**
  # ただし体験の宮殿では、初めて触る人しか居ないので切らせない
  describe "名前の上の説明" do
    it "はじめは出す" do
      get "/api/v1/settings", headers: headers

      expect(json_response["nav_hints"]).to be(true)
    end

    it "切れる" do
      patch "/api/v1/settings", params: { setting: { nav_hints: false } }, headers: headers

      expect(json_response["nav_hints"]).to be(false)
      expect(user.reload.setting.nav_hints).to be(false)
    end

    # **体験の宮殿では、切っても出す。**
    # 初めて触る人しか居ないので、説明が消えると何の場所か分からなくなる
    it "体験の宮殿では、切っても出す" do
      demo = create(:user, :confirmed, email: "demo-#{SecureRandom.hex(4)}@#{User::DEMO_EMAIL_DOMAIN}")
      demo.create_setting!(nav_hints: false)

      get "/api/v1/settings", headers: auth_headers_for(demo)

      expect(json_response["nav_hints"]).to be(true)
      # 記録そのものは変えない（体験でなくなれば、その人の設定が効く）
      expect(demo.reload.setting.nav_hints).to be(false)
    end
  end
end
