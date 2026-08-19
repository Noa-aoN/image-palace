# frozen_string_literal: true

require "rails_helper"

# 公式コンテンツの受け取り（デルフォイ）。
#
# 配る仕組みそのものは `ContentPackages::Distributor` にあり、
# ここはその入口。**デモも登録直後の持ち帰りも同じ道を通る**ので、
# ここで確かめるのは「画面に必要なものが返るか」と「断り方」。
RSpec.describe "公式コンテンツの受け取り", type: :request do
  let(:author) { create(:user, :confirmed) }
  let(:user) { create(:user, :confirmed) }
  let(:headers) { user.create_new_auth_token }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  def publish(key:, name:, titles:, kind: "starter")
    box = author.boxes.create!(name: name)
    titles.each_with_index do |title, i|
      item = author.items.create!(title: "#{title}-#{key}", item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png", content_type: "image/png")
      item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
      item.tags << (author.tags.find_by(name: "タグ-#{key}") || author.tags.create!(name: "タグ-#{key}"))
      box.box_entries.create!(entry: item, position: i + 1)
    end
    ContentPackage.publish!(key: key, kind: kind, name: name, summary: "#{name}の紹介",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  describe "GET /api/v1/content_packages" do
    let!(:it_pack) { publish(key: "starter_it", name: "ITのことば", titles: %w[DNS ルーター]) }
    let!(:myth) { publish(key: "starter_myth", name: "神話", titles: %w[ゼウス]) }

    it "受け取れるものが並ぶ" do
      get "/api/v1/content_packages", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["packages"].map { |p| p["key"] })
        .to contain_exactly("starter_it", "starter_myth")
    end

    # **中身を開かずに、何が届くか分かる**
    it "何が入っているかを数で返す" do
      get "/api/v1/content_packages", headers: headers, as: :json
      pack = json_response["packages"].find { |p| p["key"] == "starter_it" }

      expect(pack["name"]).to eq("ITのことば")
      expect(pack["summary"]).to eq("ITのことばの紹介")
      expect(pack.dig("counts", "items")).to eq(2)
      expect(pack.dig("counts", "boxes")).to eq(1)
      expect(pack.dig("counts", "tags")).to eq(1)
    end

    it "あと何個もらえるかを返す" do
      get "/api/v1/content_packages", headers: headers, as: :json

      expect(json_response["free_remaining"]).to eq(ContentInstallation::FREE_LIMIT)
    end

    it "受け取り済みかどうかが分かる" do
      ContentPackages::Distributor.call(user: user, key: "starter_it", source: "delphi")

      get "/api/v1/content_packages", headers: headers, as: :json

      expect(json_response["packages"].find { |p| p["key"] == "starter_it" }["received"]).to be(true)
      expect(json_response["packages"].find { |p| p["key"] == "starter_myth" }["received"]).to be(false)
      expect(json_response["free_remaining"]).to eq(0)
    end

    it "配るのをやめたものは並ばない" do
      myth.archive!

      get "/api/v1/content_packages", headers: headers, as: :json

      expect(json_response["packages"].map { |p| p["key"] }).to eq([ "starter_it" ])
    end

    # 体験用の宮殿ぶんは、受け取る一覧に混ぜない
    it "体験用の中身は並ばない" do
      publish(key: "demo_showcase", name: "はじまりの宮殿", titles: %w[見本], kind: "demo")

      get "/api/v1/content_packages", headers: headers, as: :json

      expect(json_response["packages"].map { |p| p["key"] }).not_to include("demo_showcase")
    end

    it "ログインしていないと見られない" do
      get "/api/v1/content_packages", as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/content_packages/:key/install" do
    let!(:it_pack) { publish(key: "starter_it", name: "ITのことば", titles: %w[DNS ルーター]) }
    let!(:myth) { publish(key: "starter_myth", name: "神話", titles: %w[ゼウス]) }

    it "自分の宮殿に入る" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(user.items.count).to eq(2)
      expect(user.boxes.pluck(:name)).to eq([ "ITのことば" ])
    end

    # 押したあと、そのまま見に行けるように
    it "着いた先を返す" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json

      expect(json_response["box_id"]).to eq(user.boxes.first.id)
      expect(json_response["created"]).to eq(2)
    end

    it "同じものは2回受け取れない" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to match(/すでに受け取って/)
      expect(user.items.count).to eq(2)
    end

    it "無料で取れるのは決めた数まで" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json

      post "/api/v1/content_packages/starter_myth/install", headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to match(/無料で受け取れるのは/)
    end

    it "無いものは受け取れない" do
      post "/api/v1/content_packages/no_such/install", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "ログインしていないと受け取れない" do
      post "/api/v1/content_packages/starter_it/install", as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # 受け取ったものは、その人自身のもの。**自由に直せる**
    it "受け取ったあとは、自分のカードとして直せる" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json
      item = user.items.first

      patch "/api/v1/items/#{item.id}", params: { item: { title: "わたしの言葉" } },
                                        headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.title).to eq("わたしの言葉")
    end

    # 由来は残る。**題を変えても、公式由来であることは分かる**
    it "直しても、どこから来たかは残る" do
      post "/api/v1/content_packages/starter_it/install", headers: headers, as: :json
      item = user.items.first
      item.update!(title: "書き換えた")

      expect(ContentInstallationEntry.official?(item.reload)).to be(true)
    end
  end
end
