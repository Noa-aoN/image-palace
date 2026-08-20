# frozen_string_literal: true

require "rails_helper"

# 体験用の宮殿の入口。ログイン不要で、押すとその場で宮殿が建つ。
#
# **認証が要らない、ただ1つの書き込み口**なので、守りをここで固める。
RSpec.describe "体験用の宮殿", type: :request do
  # 入口の栓。**既定は「準備中」**（作りかけのまま外に開かないように）。
  # ここを開けた状態で、中の動きを確かめる
  before { FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "released") }

  let(:author) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  # 配る中身を用意する。**実際に書き出したものを使う**
  let!(:package) do
    box = author.boxes.create!(name: "見本の箱")
    %w[DNS ルーター].each_with_index do |title, i|
      item = author.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{i}.png", content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end
    view = author.views.create!(name: "見本のキャンバス", view_type: "freeboard")
    box.box_entries.map(&:entry).each_with_index do |item, i|
      view.view_items.create!(item: item, x: i * 300, y: 0, position: i)
    end

    ContentPackage.publish!(
      key: Demo::Session::PACKAGE_KEY, kind: "demo", name: "はじまりの宮殿",
      payload: ContentPackages::Exporter.call(boxes: [ box ], views: [ view ])
    )
  end

  describe "POST /api/v1/demo" do
    it "ログインしていなくても宮殿が建つ" do
      post "/api/v1/demo", as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["reused"]).to be(false)
      expect(json_response.dig("tokens", "access-token")).to be_present
    end

    it "入った瞬間から、育った宮殿がそこにある" do
      post "/api/v1/demo", as: :json
      user = User.demo_accounts.last

      expect(user.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
      expect(user.boxes.pluck(:name)).to eq([ "見本の箱" ])
      expect(user.views.first.view_items.count).to eq(2)
    end

    it "案内をもう一度出さない" do
      post "/api/v1/demo", as: :json
      setting = User.demo_accounts.last.setting

      expect(setting.onboarded_at).to be_present
      expect(setting.palace_name).to eq("はじまりの宮殿")
    end

    it "受け取ったトークンで、そのまま通常の画面に入れる" do
      post "/api/v1/demo", as: :json
      tokens = json_response["tokens"]

      get "/api/v1/items", headers: tokens, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["items"].size).to eq(2)
    end

    it "いつ消えるかを返す" do
      post "/api/v1/demo", as: :json

      expect(Time.zone.parse(json_response["expires_at"]))
        .to be_within(1.minute).of(Time.current + Demo::Session::LIFETIME)
    end

    it "体験の記念を1つ渡す" do
      post "/api/v1/demo", as: :json
      user = User.demo_accounts.last

      expect(user.user_rewards.joins(:reward_definition)
                 .where(reward_definitions: { key: Demo::Session::MEDAL_KEY })).to exist
    end

    # 見本の28枚があるだけで実績は正直に解けてしまう。**残高は動かさない**
    it "記念でクレジットは増えない" do
      post "/api/v1/demo", as: :json
      user = User.demo_accounts.last

      expect(user.available_credit_points).to eq(0)
    end

    it "秘密を返さない" do
      post "/api/v1/demo", as: :json

      expect(json_response["user"].keys).not_to include("totp_secret", "encrypted_password")
    end
  end

  # ここが一番効く守り。**同じ端末からの連打は、そもそも作らない**
  describe "同じ端末から、もう一度押したとき" do
    def resume(token)
      post "/api/v1/demo", params: { resume_token: token }, as: :json
    end

    it "新しく作らず、さっきの宮殿へ戻る" do
      post "/api/v1/demo", as: :json
      first = User.demo_accounts.last
      token = json_response["resume_token"]

      expect { resume(token) }.not_to change(User, :count)

      expect(json_response["reused"]).to be(true)
      expect(response).to have_http_status(:ok)
      expect(User.demo_accounts.last.id).to eq(first.id)
    end

    it "戻ったあとも、そのまま入れる" do
      post "/api/v1/demo", as: :json
      resume(json_response["resume_token"])

      get "/api/v1/items", headers: json_response["tokens"], as: :json
      expect(response).to have_http_status(:success)
    end

    # 覚えている宮殿が寿命で消えていたら、新しく建てる
    it "寿命が切れていたら、新しく建てる" do
      post "/api/v1/demo", as: :json
      token = json_response["resume_token"]
      User.demo_accounts.last
          .update_column(:created_at, Demo::Session::LIFETIME.ago - 1.hour) # rubocop:disable Rails/SkipsModelValidations

      resume(token)

      expect(json_response["reused"]).to be(false)
      expect(User.demo_accounts.count).to eq(2)
    end

    # ここが署名の値打ち。**他人の宮殿を指す合鍵は作れない**
    it "でたらめな合鍵では、他人の宮殿に入れない" do
      post "/api/v1/demo", as: :json
      victim = User.demo_accounts.last

      resume(victim.id) # 署名なしの、ただの id

      expect(json_response["reused"]).to be(false)
      expect(User.demo_accounts.count).to eq(2)
    end

    it "他人の合鍵を作れない" do
      victim = create(:user, :confirmed, email: "v@#{User::DEMO_EMAIL_DOMAIN}")
      forged = Base64.strict_encode64(victim.id)

      resume(forged)

      expect(json_response["reused"]).to be(false)
    end
  end

  describe "混み合っているとき" do
    it "1日の上限を超えたら、丁寧に断る" do
      stub_const("Demo::Session::DAILY_CAP", 1)
      post "/api/v1/demo", as: :json

      post "/api/v1/demo", as: :json # 合鍵を渡さない＝別の端末から

      expect(response).to have_http_status(:service_unavailable)
      expect(json_response["code"]).to eq("demo_unavailable")
      expect(json_response["error"]).to match(/混み合って/)
    end

    it "同時に立っている数の上限も効く" do
      stub_const("Demo::Session::CONCURRENT_CAP", 1)
      post "/api/v1/demo", as: :json

      post "/api/v1/demo", as: :json

      expect(response).to have_http_status(:service_unavailable)
    end

    it "配る中身が無ければ、建てずに断る" do
      package.archive!

      post "/api/v1/demo", as: :json

      expect(response).to have_http_status(:service_unavailable)
      expect(User.demo_accounts.count).to eq(0)
    end
  end

  describe "体験用の口座として扱われる" do
    before { post "/api/v1/demo", as: :json }

    let(:tokens) { json_response["tokens"] }

    it "禁じた操作は通らない" do
      post "/api/v1/billing/checkout", params: { plan: "standard" }, headers: tokens, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(json_response["code"]).to eq("demo_forbidden")
    end

    it "数えるときは外れる" do
      expect(User.external.count).to eq(1) # 見本を作った人だけ
    end
  end

  # 「出る」に実体を持たせる。中身は毎回まったく同じなので、
  # 押し間違えても失うものが無い
  describe "体験を終える" do
    before { post "/api/v1/demo", as: :json }

    let(:tokens) { json_response["tokens"] }

    it "宮殿ごと片付く" do
      user = User.demo_accounts.last

      expect { delete "/api/v1/demo", headers: tokens, as: :json }
        .to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
      expect(User.find_by(id: user.id)).to be_nil
    end

    it "中身も一緒に落ちる" do
      expect { delete "/api/v1/demo", headers: tokens, as: :json }
        .to change(Item, :count).by(-2)
      expect(Box.where(user_id: User.demo_accounts.pluck(:id))).to be_empty
    end

    # 次に来た人がまた同じ絵を使う
    it "共有している絵は消さない" do
      expect { perform_enqueued_jobs { delete "/api/v1/demo", headers: tokens, as: :json } }
        .not_to change { author.items.map { |i| i.primary_media.file.attached? } }
    end

    # **体験用の口座しか消せない。** ここが緩いと、退会の禁止を回り込める
    it "普通の利用者は、ここでは消えない" do
      normal = create(:user, :confirmed)

      expect { delete "/api/v1/demo", headers: normal.create_new_auth_token, as: :json }
        .not_to change(User, :count)

      expect(response).to have_http_status(:no_content)
      expect(User.find_by(id: normal.id)).to be_present
    end

    it "ログインしていなければ断る" do
      delete "/api/v1/demo", as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  # **画面の出し分けは守りではない。** サーバー側でも栓を見る
  describe "入口が準備中のとき" do
    before { FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "development") }

    it "宮殿を建てない" do
      expect { post "/api/v1/demo", as: :json }.not_to change(User, :count)

      expect(response).to have_http_status(:service_unavailable)
      expect(json_response["error"]).to match(/準備中/)
    end

    it "入口ごと出さないときも、建てない" do
      FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "hidden")

      post "/api/v1/demo", as: :json

      expect(response).to have_http_status(:service_unavailable)
    end
  end

  describe "片付け" do
    it "寿命の切れたものだけ消す" do
      post "/api/v1/demo", as: :json
      old = User.demo_accounts.last
      old.update_column(:created_at, Demo::Session::LIFETIME.ago - 1.hour) # rubocop:disable Rails/SkipsModelValidations
      post "/api/v1/demo", as: :json
      fresh = User.demo_accounts.order(:created_at).last

      expect(DemoCleanupJob.new.perform).to eq(1)

      expect(User.find_by(id: old.id)).to be_nil
      expect(User.find_by(id: fresh.id)).to be_present
    end

    it "普通の利用者には触れない" do
      normal = create(:user, :confirmed)

      DemoCleanupJob.new.perform

      expect(User.find_by(id: normal.id)).to be_present
      expect(User.find_by(id: author.id)).to be_present
    end

    it "宮殿ごと落ちる" do
      post "/api/v1/demo", as: :json
      user = User.demo_accounts.last
      user.update_column(:created_at, Demo::Session::LIFETIME.ago - 1.hour) # rubocop:disable Rails/SkipsModelValidations

      expect { DemoCleanupJob.new.perform }.to change(Item, :count).by(-2)
      expect(Box.where(user_id: user.id)).to be_empty
    end

    # 次に来た人がまた同じ絵を使う。**消してはいけない**
    it "共有している絵は消さない" do
      post "/api/v1/demo", as: :json
      user = User.demo_accounts.last
      user.update_column(:created_at, Demo::Session::LIFETIME.ago - 1.hour) # rubocop:disable Rails/SkipsModelValidations

      expect { perform_enqueued_jobs { DemoCleanupJob.new.perform } }
        .not_to change { author.items.map { |i| i.primary_media.file.attached? } }
    end
  end
end
