# frozen_string_literal: true

require "rails_helper"

# 公式工房。**選んで・確かめて・出す。**
#
# 大事なのは2つ。
#
#   ① 公式宮殿にあるもの全部が、公開物ではない
#      → 選んだものだけが荷物になる
#   ② 原本を編集しても、公開済みの荷物は変わらない
#      → 下書き → 下見 → 公開 が分かれている
RSpec.describe "公式工房", type: :request do
  let(:studio_user) { create(:user, :confirmed, role: "admin") }
  let(:headers) { studio_user.create_new_auth_token }
  let(:official) { create(:user, :confirmed, email: "studio@example.com") }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  around do |example|
    original = ENV["OFFICIAL_CONTENT_USER_ID"]
    ENV["OFFICIAL_CONTENT_USER_ID"] = official.id
    example.run
    ENV["OFFICIAL_CONTENT_USER_ID"] = original
  end

  def make_box(name, titles)
    box = official.boxes.create!(name: name)
    titles.each_with_index do |title, i|
      item = official.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png", content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end
    box
  end

  # **出すもの**と、**出さないもの**を両方置く
  let!(:published_box) { make_box("出すもの", %w[DNS ルーター]) }
  let!(:private_box) { make_box("まだ出さないもの", %w[つくりかけ]) }

  describe "入れる人" do
    it "権限があれば入れる" do
      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(response).to have_http_status(:success)
    end

    it "運営でも、工房の権限が無ければ入れない" do
      operator = create(:user, :confirmed, role: "operator")

      get "/api/v1/admin/studio", headers: operator.create_new_auth_token, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(json_response["error"]).to match(/工房室/)
    end

    it "一般の人は入れない" do
      get "/api/v1/admin/studio", headers: create(:user, :confirmed).create_new_auth_token, as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "ログインしていなければ入れない" do
      get "/api/v1/admin/studio", as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # **原本を持つ口座は、役割が user でも入れる。**
    # その口座が既に全部を所有しているので、公開の可否だけを分けても
    # 守れる範囲はさほど増えない
    it "原本を持つ口座は、役割が user でも入れる" do
      get "/api/v1/admin/studio", headers: official.create_new_auth_token, as: :json

      expect(response).to have_http_status(:success)
    end

    # 持ち主だからといって、人やお金は触れない
    it "原本を持つ口座でも、執務室には入れない" do
      get "/api/v1/admin/overview", headers: official.create_new_auth_token, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  # 工房は公開まで届く場所。**合鍵ひとつで公開まで開くのを避ける。**
  # 執務室と同じ関門を使う
  describe "本人確認を求めるとき" do
    around do |example|
      original = ENV["ADMIN_STRONG_AUTH_ENABLED"]
      ENV["ADMIN_STRONG_AUTH_ENABLED"] = "true"
      example.run
      ENV["ADMIN_STRONG_AUTH_ENABLED"] = original
    end

    it "確かめていなければ、入口で止まる" do
      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(json_response["code"]).to be_in(%w[strong_auth_required strong_auth_setup_required])
    end

    it "手立てが無ければ、設定を促す" do
      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(json_response["code"]).to eq("strong_auth_setup_required")
      expect(json_response["error"]).to match(/パスキーか認証アプリ/)
    end

    # **入る場所の名前で言う。** 執務室の話をされていると読まれないように
    it "断り方が、工房室の話になっている" do
      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(json_response["error"]).to match(/工房室/)
      expect(json_response["error"]).not_to match(/執務室/)
    end

    it "確かめていれば、通る" do
      studio_user.update!(totp_secret: Auth::Totp.generate_secret, totp_confirmed_at: Time.current)
      client = headers["client"]
      StrongAuthSession.record!(user: studio_user, client_id: client, method: "totp")

      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(response).to have_http_status(:success)
    end

    # 求めない設定（既定）のときは、これまでどおり素通りする
    it "求めない設定なら、素通りする" do
      ENV["ADMIN_STRONG_AUTH_ENABLED"] = "false"

      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(response).to have_http_status(:success)
    end
  end

  describe "原本を選ぶ" do
    it "公式の口座にある箱とキャンバスが並ぶ" do
      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(json_response["boxes"].map { |b| b["name"] })
        .to contain_exactly("出すもの", "まだ出さないもの")
    end

    it "何枚入っているかが分かる" do
      get "/api/v1/admin/studio/sources", headers: headers, as: :json
      box = json_response["boxes"].find { |b| b["name"] == "出すもの" }

      expect(box["items"]).to eq(2)
    end

    # 宮殿に結びついたキャンバスは、まだ運べない。**選ぶ前に分かるようにする**
    it "運べないキャンバスは、そうと分かる" do
      space = official.spaces.create!(name: "宮殿", space_type: "road")
      official.views.create!(name: "宮殿の板", view_type: "freeboard", space_id: space.id)
      official.views.create!(name: "ふつうの板", view_type: "freeboard")

      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(json_response["views"].to_h { |v| [ v["name"], v["portable"] ] })
        .to eq({ "宮殿の板" => false, "ふつうの板" => true })
    end

    it "公式の口座が無ければ、そうと言う" do
      ENV["OFFICIAL_CONTENT_USER_ID"] = nil

      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(response).to have_http_status(:service_unavailable)
      expect(json_response["code"]).to eq("official_account_missing")
    end

    # **落ちるのではなく、そうと言って断る。**
    # 起こす側にも同じ栓が要る（無いと nil を触って 500 になる）
    it "公式の口座が無ければ、下書きも起こせない" do
      ENV["OFFICIAL_CONTENT_USER_ID"] = nil

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_x", kind: "starter", name: "x", box_ids: [] },
           headers: headers, as: :json

      expect(response).to have_http_status(:service_unavailable)
      expect(json_response["code"]).to eq("official_account_missing")
    end

    # 口座が設定されていなくても、様子を見る画面は開ける
    it "公式の口座が無くても、様子は見られる" do
      ENV["OFFICIAL_CONTENT_USER_ID"] = nil

      get "/api/v1/admin/studio", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["owner"]).to be_nil
    end
  end

  describe "設定" do
    it "いまの様子が分かる" do
      get "/api/v1/admin/studio/settings", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response.dig("official_account", "configured")).to be(true)
      expect(json_response["allowance_limit_credits"]).to be_a(Integer)
      expect(json_response["demo_entry_stage"]).to be_present
    end

    # **制作だけの人は執務室に入れない。** 同じ栓をここにも出す
    it "枠の上限を変えられる" do
      patch "/api/v1/admin/studio/settings",
            params: { allowance_limit_credits: 250 }, headers: headers, as: :json

      expect(json_response["allowance_limit_credits"]).to eq(250)
      expect(GrantPolicy.amount_for(StudioAllowance::POLICY_KEY)).to eq(250)
    end

    it "体験の入口を開け閉めできる" do
      patch "/api/v1/admin/studio/settings",
            params: { demo_entry_stage: "released" }, headers: headers, as: :json

      expect(json_response["demo_entry_stage"]).to eq("released")
      expect(Demo::Session.open?).to be(true)

      patch "/api/v1/admin/studio/settings",
            params: { demo_entry_stage: "development" }, headers: headers, as: :json

      expect(Demo::Session.open?).to be(false)
    end

    # **一般に開ける操作**なので、記録に残す
    it "入口を開けたことが記録に残る" do
      expect {
        patch "/api/v1/admin/studio/settings",
              params: { demo_entry_stage: "released" }, headers: headers, as: :json
      }.to change { AdminAuditLog.where(action: "studio.demo_entry").count }.by(1)
    end

    it "知らない段階は受け付けない" do
      before_stage = FeatureFlag.stages["demo_entry"]

      patch "/api/v1/admin/studio/settings",
            params: { demo_entry_stage: "wide_open" }, headers: headers, as: :json

      expect(FeatureFlag.stages["demo_entry"]).to eq(before_stage)
    end

    it "配る中身があるかも分かる（開ける前に気づけるように）" do
      get "/api/v1/admin/studio/settings", headers: headers, as: :json

      expect(json_response.dig("demo_package", "published")).to be(false)
    end

    it "権限が無ければ触れない" do
      patch "/api/v1/admin/studio/settings",
            params: { demo_entry_stage: "released" },
            headers: create(:user, :confirmed, role: "operator").create_new_auth_token, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Demo::Session.open?).to be(false)
    end
  end

  describe "下書きを起こす" do
    def draft!(box_ids: [ published_box.id ], key: "starter_test", **extra)
      post "/api/v1/admin/studio/draft",
           params: { key: key, kind: "starter", name: "ためし", box_ids: box_ids }.merge(extra),
           headers: headers, as: :json
    end

    it "選んだものだけが入る" do
      draft!

      expect(response).to have_http_status(:created)
      titles = ContentPackage.last.payload["items"].map { |i| i["title"] }
      expect(titles).to contain_exactly("DNS", "ルーター")
    end

    # ここが肝。**宮殿にあるもの全部が公開物ではない**
    it "選ばなかったものは入らない" do
      draft!

      expect(ContentPackage.last.payload["items"].map { |i| i["title"] }).not_to include("つくりかけ")
    end

    it "できたては下書き（まだ誰にも配らない）" do
      draft!

      expect(ContentPackage.last.status).to eq("draft")
      expect(ContentPackage.distributable).to be_empty
    end

    it "何も選ばなければ断る" do
      draft!(box_ids: [])

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to match(/1つ以上/)
    end

    # 欠けは**公開の前に**見つかる
    it "絵の無いカードが混ざっていたら、そこで止まる" do
      broken = official.items.create!(title: "絵なし", item_type: word, generation_status: "completed")
      broken.meanings.create!(definition: "…", language_code: "ja", position: 0)
      published_box.box_entries.create!(entry: broken, position: 99)

      draft!

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to match(/絵がありません/)
    end

    it "下書きを起こし直すと、前の下書きは残らない" do
      draft!
      expect { draft! }.not_to change { ContentPackage.where(key: "starter_test").count }
    end

    it "運営の記録に残る" do
      expect { draft! }.to change { AdminAuditLog.where(action: "content_package.draft").count }.by(1)
    end
  end

  describe "下見" do
    before do
      post "/api/v1/admin/studio/draft",
           params: { key: "starter_test", kind: "starter", name: "ためし", box_ids: [ published_box.id ] },
           headers: headers, as: :json
    end

    def preview!
      post "/api/v1/admin/studio/starter_test/1/preview", headers: headers, as: :json
    end

    it "自分の口座に入って、受け取った人と同じ画面で見られる" do
      preview!

      expect(response).to have_http_status(:success)
      expect(studio_user.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
      expect(json_response["box_id"]).to be_present
    end

    it "何度でも見られる（前の下見は片付く）" do
      preview!
      expect { preview! }.not_to change { studio_user.items.count }
    end

    # **下見は受け取りではない。** 配布数にも無料枠にも入らない
    it "配った数には数えない" do
      preview!

      get "/api/v1/admin/studio", headers: headers, as: :json
      package = json_response["packages"].find { |p| p["key"] == "starter_test" }

      expect(package["installs"]).to eq(0)
    end

    it "無料枠を使わない" do
      preview!

      expect(ContentInstallation.free_used?(studio_user)).to be(false)
    end

    it "片付けられる" do
      preview!

      delete "/api/v1/admin/studio/starter_test/1/preview", headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(studio_user.items).to be_empty
      expect(studio_user.boxes).to be_empty
    end

    # 下見しても、まだ誰にも配らない
    it "下見だけでは公開されない" do
      preview!

      expect(ContentPackage.distributable).to be_empty
    end
  end

  describe "扱いを変える" do
    before do
      post "/api/v1/admin/studio/draft",
           params: { key: "starter_test", kind: "starter", name: "ためし", box_ids: [ published_box.id ] },
           headers: headers, as: :json
    end

    def change_status(action, key: "starter_test", version: 1)
      patch "/api/v1/admin/studio/#{key}/#{version}/status",
            params: { status_action: action }, headers: headers, as: :json
    end

    it "下書きを公開できる" do
      change_status("publish")

      expect(response).to have_http_status(:success)
      expect(json_response.dig("package", "status")).to eq("published")
      expect(ContentPackage.latest_published("starter_test")).to be_present
    end

    # **誤って出したときは、削除ではなく止める**
    it "止められる（戻せる）" do
      change_status("publish")
      change_status("suspend")

      expect(json_response.dig("package", "status")).to eq("suspended")
      expect(ContentPackage.latest_published("starter_test")).to be_nil

      change_status("resume")
      expect(json_response.dig("package", "status")).to eq("published")
    end

    it "役目を終えられる" do
      change_status("publish")
      change_status("archive")

      expect(json_response.dig("package", "status")).to eq("archived")
    end

    it "終えたものは配り直せない" do
      change_status("publish")
      change_status("archive")

      change_status("resume")

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "知らない操作は断る" do
      change_status("explode")

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "運営の記録に残る" do
      expect { change_status("publish") }
        .to change { AdminAuditLog.where(action: "content_package.publish").count }.by(1)
    end
  end

  # ここが「Draft / Snapshot / Published を分ける」ことの中身
  describe "原本を編集しても、出したものは変わらない" do
    before do
      post "/api/v1/admin/studio/draft",
           params: { key: "starter_test", kind: "starter", name: "ためし", box_ids: [ published_box.id ] },
           headers: headers, as: :json
      patch "/api/v1/admin/studio/starter_test/1/status",
            params: { status_action: "publish" }, headers: headers, as: :json
    end

    it "原本の題を変えても、荷物は変わらない" do
      official.items.find_by(title: "DNS").update!(title: "まったく別の名前")

      expect(ContentPackage.latest_published("starter_test").payload["items"].map { |i| i["title"] })
        .to contain_exactly("DNS", "ルーター")
    end

    it "原本の箱を消しても、配れる" do
      official.boxes.destroy_all

      receiver = create(:user, :confirmed)
      result = ContentPackages::Distributor.call(user: receiver, key: "starter_test", source: "delphi")

      expect(result.created_count).to eq(2)
    end

    it "止めても、受け取った人の手元は変わらない" do
      receiver = create(:user, :confirmed)
      ContentPackages::Distributor.call(user: receiver, key: "starter_test", source: "delphi")

      patch "/api/v1/admin/studio/starter_test/1/status",
            params: { status_action: "suspend" }, headers: headers, as: :json

      expect(receiver.items.count).to eq(2)
      expect(ContentInstallation.find_by(user_id: receiver.id)).to be_present
    end
  end
end
