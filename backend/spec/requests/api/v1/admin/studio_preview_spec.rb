# frozen_string_literal: true

require "rails_helper"

# 公式コンテンツの下見。**出す前に、受け取った人と同じ画面で見る。**
#
# 自分の口座に入れて見るので、形は受け取りと同じになる。
# だが**中身は同じでも、数えるものが違う**。ここを取り違えると、
# 下見しただけで配布数が増え、無料枠が減り、本番の数字が汚れる。
RSpec.describe "公式コンテンツの下見", type: :request do
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

  def make_package(key:, titles:)
    box = official.boxes.create!(name: "#{key} の箱")
    titles.each_with_index do |title, i|
      item = official.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                       content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end

    ContentPackage.publish!(key: key, kind: "starter", name: "#{key} のなまえ",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  let!(:package) { make_package(key: "starter_it", titles: %w[DNS ルーター]) }

  def start_preview(key: package.key, version: package.version)
    post "/api/v1/admin/studio/#{key}/#{version}/preview", headers: headers, as: :json
  end

  describe "始める" do
    it "自分の口座に入って、開く先が返る" do
      start_preview

      expect(response).to have_http_status(:success)
      expect(json_response["active"]).to be(true)
      expect(json_response["box_id"]).to be_present
      expect(json_response["items"]).to eq(2)
      expect(studio_user.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end

    it "いつ消えるかも返る" do
      start_preview

      expect(Time.zone.parse(json_response["expires_at"]))
        .to be_within(1.minute).of(Studio::Preview::LIFETIME.from_now)
    end

    # **何度でも押せる。** 押すたびに宮殿が散らかると、どれが本物か分からなくなる
    it "何度押しても、宮殿は散らからない" do
      3.times { start_preview }

      expect(studio_user.items.count).to eq(2)
      expect(studio_user.boxes.count).to eq(1)
      expect(ContentInstallation.where(user_id: studio_user.id).count).to eq(1)
    end

    # 別の荷物を見たら、前のは片付く。**いつも1つだけ**
    it "別の荷物を下見すると、前のは片付く" do
      start_preview
      other = make_package(key: "starter_words", titles: %w[ことば])

      post "/api/v1/admin/studio/#{other.key}/#{other.version}/preview", headers: headers, as: :json

      expect(studio_user.reload.items.pluck(:title)).to eq([ "ことば" ])
      expect(ContentInstallation.where(user_id: studio_user.id).count).to eq(1)
    end

    it "下書きも下見できる（出す前に見るための仕組みなので）" do
      draft = ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                                    payload: package.payload)

      start_preview(version: draft.version)

      expect(response).to have_http_status(:success)
      expect(studio_user.items.count).to eq(2)
    end

    it "記録に残る" do
      expect { start_preview }
        .to change { AdminAuditLog.where(action: "content_package.preview").count }.by(1)
    end
  end

  # ── 数えるものが違う ──────────────────────────
  describe "本番の数字を汚さない" do
    before { start_preview }

    it "配った数に入らない" do
      get "/api/v1/admin/studio", headers: headers, as: :json

      row = json_response["packages"].find { |p| p["key"] == "starter_it" }
      expect(row["installs"]).to eq(0)
    end

    it "受け取りとして数えない" do
      expect(ContentInstallation.real.where(user_id: studio_user.id)).to be_empty
    end

    # **無料枠を使わない。** 下見しただけで受け取れなくなるのはおかしい
    it "無料枠が減らない" do
      get "/api/v1/content_packages", headers: auth_headers_for(studio_user), as: :json

      expect(json_response["free_remaining"]).to eq(ContentInstallation::FREE_LIMIT)
      expect(ContentInstallation.free_used?(studio_user)).to be(false)
    end

    # すでに受け取っている荷物でも下見できる。
    # **v1 を持ったまま v3 を下見する**、はやりたいことそのもの
    it "すでに受け取っている荷物でも下見できる" do
      ContentDelivery.set!(package_key: "starter_words", channel: "delphi", enabled: true)
      other = make_package(key: "starter_words", titles: %w[ことば])
      ContentPackages::Distributor.call(user: studio_user, key: "starter_words", source: "delphi")

      post "/api/v1/admin/studio/#{other.key}/#{other.version}/preview", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(ContentInstallation.real.where(user_id: studio_user.id).count).to eq(1)
      expect(ContentInstallation.where(user_id: studio_user.id, source: "preview").count).to eq(1)
    end
  end

  # ── いま見ているもの ─────────────────────────
  describe "いま見ているもの" do
    it "何も見ていなければ、そう返る" do
      get "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(json_response["active"]).to be(false)
    end

    it "見ていれば、荷物と開く先が返る" do
      start_preview

      get "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(json_response["active"]).to be(true)
      expect(json_response["key"]).to eq("starter_it")
      expect(json_response["name"]).to eq("starter_it のなまえ")
      expect(json_response["box_id"]).to be_present
    end

    # 寿命が切れていたら、掃除より先に「見ていない」と言う
    it "寿命が切れていれば、見ていないことになる" do
      start_preview
      ContentInstallation.where(source: "preview")
                         .update_all(installed_at: Studio::Preview::LIFETIME.ago - 1.minute)

      get "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(json_response["active"]).to be(false)
    end
  end

  # ── 終わる ────────────────────────────────
  describe "終える" do
    before { start_preview }

    it "カードごと片付く" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(studio_user.reload.items.count).to eq(0)
      expect(studio_user.boxes.count).to eq(0)
      expect(ContentInstallation.where(user_id: studio_user.id)).to be_empty
    end

    # **公式の宮殿には手を出さない。** 消えるのは自分の口座に入れた複製だけ
    it "公式の宮殿は減らない" do
      expect { delete "/api/v1/admin/studio/preview", headers: headers, as: :json }
        .not_to change { official.items.count }
    end

    it "見ていなくても押せる" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(response).to have_http_status(:no_content)
    end

    it "終えたあと、また始められる" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json
      start_preview

      expect(response).to have_http_status(:success)
      expect(studio_user.reload.items.count).to eq(2)
    end
  end

  # ── 放っておいても消える ────────────────────
  describe "寿命" do
    it "寿命の切れた下見は、掃除で片付く" do
      start_preview
      ContentInstallation.where(source: "preview")
                         .update_all(installed_at: Studio::Preview::LIFETIME.ago - 1.minute)

      expect(Studio::Preview.sweep!).to eq(1)
      expect(studio_user.reload.items.count).to eq(0)
      expect(ContentInstallation.where(user_id: studio_user.id)).to be_empty
    end

    it "まだ生きている下見は片付けない" do
      start_preview

      expect(Studio::Preview.sweep!).to eq(0)
      expect(studio_user.reload.items.count).to eq(2)
    end

    # 掃除が受け取りまで巻き込まない。**消えてよいのは下見だけ**
    it "受け取ったものは、古くても片付けない" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      receiver = create(:user, :confirmed)
      ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "delphi")
      ContentInstallation.where(source: "delphi").update_all(installed_at: 10.years.ago)

      expect(Studio::Preview.sweep!).to eq(0)
      expect(receiver.reload.items.count).to eq(2)
    end
  end

  # ── 触れる人 ───────────────────────────────
  describe "触れる人" do
    it "工房の権限が無ければ、始めることも見ることも終えることもできない" do
      other = create(:user, :confirmed).create_new_auth_token

      post "/api/v1/admin/studio/starter_it/1/preview", headers: other, as: :json
      expect(response).to have_http_status(:forbidden)

      get "/api/v1/admin/studio/preview", headers: other, as: :json
      expect(response).to have_http_status(:forbidden)

      delete "/api/v1/admin/studio/preview", headers: other, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    # **下見は自分の口座の中にしか無い。** ほかの人からは見えようがない
    it "下見で入ったカードは、その人の宮殿にしか無い" do
      start_preview
      other = create(:user, :confirmed)

      get "/api/v1/items", headers: auth_headers_for(other), as: :json

      titles = (json_response["items"] || json_response).map { |i| i["title"] }
      expect(titles).to be_empty
    end
  end
end
