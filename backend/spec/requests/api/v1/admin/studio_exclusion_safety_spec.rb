# frozen_string_literal: true

require "rails_helper"

# 「出さない」が、**変えてはいけないものを変えていない**ことを固定する。
#
# 工房室は公開まで届く場所なので、ここでの1押しが
# すでに外に出たものへ波及すると気づかないまま広がる。
#
# 変わってよいのは「次に起こす下書き」だけ。
RSpec.describe "「出さない」が波及しないこと", type: :request do
  let(:studio_user) { create(:user, :confirmed, role: "admin") }
  let(:headers) { studio_user.create_new_auth_token }
  let(:official) { create(:user, :confirmed, email: "studio@example.com") }
  let(:receiver) { create(:user, :confirmed) }
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

  let!(:box) do
    b = official.boxes.create!(name: "ITのことば")
    %w[DNS ルーター].each_with_index do |title, i|
      item = official.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                       content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      b.box_entries.create!(entry: item, position: i + 1)
    end
    b
  end

  let(:dns) { official.items.find_by(title: "DNS") }

  # 出して、受け取ってもらったあとに外す。**外に出たあとの世界を触らない**
  let!(:package) do
    ContentPackage.publish!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  let!(:installation) do
    ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
    ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "delphi").installation
  end

  def exclude!(item = dns, excluded: true)
    patch "/api/v1/admin/studio/items/#{item.id}/exclusion",
          params: { excluded: excluded }, headers: headers, as: :json
  end

  # ── 出した荷物は動かない ───────────────────────
  #
  # 公開したものは変えない決まり。外しても、荷物の中身は同じまま
  describe "すでに出した荷物" do
    it "中身が変わらない" do
      before_payload = package.reload.payload

      expect { exclude! }.not_to change { package.reload.payload }
      expect(before_payload["items"].map { |i| i["title"] }).to eq(%w[DNS ルーター])
    end

    it "版も扱いも変わらない" do
      expect { exclude! }
        .not_to change { [ package.reload.version, package.status, package.published_at ] }
    end

    it "配られ続ける（止めたわけではない）" do
      exclude!

      another = create(:user, :confirmed)
      post "/api/v1/content_packages/starter_it/install",
           headers: auth_headers_for(another), as: :json

      expect(response).to have_http_status(:created)
      expect(another.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end
  end

  # ── 受け取った人の宮殿は動かない ───────────────
  describe "すでに受け取った人" do
    it "手元のカードは消えない" do
      expect { exclude! }.not_to change { receiver.items.count }
      expect(receiver.reload.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end

    it "受け取りの記録も消えない" do
      expect { exclude! }.not_to change { ContentInstallation.where(user_id: receiver.id).count }
    end

    # **由来を消さない。** 「これは公式由来」が消えると、あとから辿れなくなる
    it "由来も変わらない" do
      before_entries = installation.entries.order(:record_id)
                                   .pluck(:record_type, :package_local_key, :origin_key)

      exclude!

      expect(installation.reload.entries.order(:record_id)
                         .pluck(:record_type, :package_local_key, :origin_key)).to eq(before_entries)
    end

    it "由来の目印が、元のカードを指したまま" do
      exclude!

      origin = installation.entries.find_by(record_type: "Item", package_local_key: "item_1").origin_key
      expect(origin).to eq(dns.id)
    end
  end

  # ── 公式宮殿そのものは動かない ────────────────
  #
  # 「出さない」は配り方の話。**カードを消す操作ではない**
  describe "公式の宮殿" do
    it "カードは消えない" do
      expect { exclude! }.not_to change { official.items.count }
      expect(official.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end

    it "箱からも外れない" do
      exclude!

      expect(box.reload.box_entries.map { |e| e.entry.title }).to contain_exactly("DNS", "ルーター")
    end

    # 公式のアカウントで普通にカード一覧を開いたら、いつもどおり出てくる
    it "ふだんのカード一覧には、そのまま出てくる" do
      exclude!

      get "/api/v1/items", headers: auth_headers_for(official), as: :json

      expect(response).to have_http_status(:success)
      titles = (json_response["items"] || json_response).map { |i| i["title"] }
      expect(titles).to include("DNS")
    end

    it "工房室の一覧にも、そのまま出てくる（印が付くだけ）" do
      exclude!

      get "/api/v1/admin/studio/items", headers: headers, as: :json

      row = json_response["items"].find { |i| i["title"] == "DNS" }
      expect(row).to be_present
      expect(row["excluded"]).to be(true)
      expect(row["boxes"]).to include("ITのことば")
    end
  end

  # ── 次に起こす下書きにだけ効く ────────────────
  describe "次に起こす下書き" do
    it "外したカードが入らない" do
      exclude!

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_it", kind: "starter", name: "ITのことば", box_ids: [ box.id ] },
           headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["package"]["counts"]["items"]).to eq(1)
      expect(json_response["package"]["version"]).to eq(2)
    end

    it "戻せば、また入る" do
      exclude!
      exclude!(excluded: false)

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_it", kind: "starter", name: "ITのことば", box_ids: [ box.id ] },
           headers: headers, as: :json

      expect(json_response["package"]["counts"]["items"]).to eq(2)
    end
  end

  # ── 触れる人を、口ごとに確かめる ──────────────
  #
  # 門は入口ごとではなく全体に掛けてあるが、**掛け方が変わっても気づける**ように
  # 口ごとに押してみる
  describe "触れる人" do
    it "工房の権限が無ければ、見ることも書き換えることもできない" do
      other = create(:user, :confirmed).create_new_auth_token

      get "/api/v1/admin/studio/items", headers: other, as: :json
      expect(response).to have_http_status(:forbidden)

      patch "/api/v1/admin/studio/items/#{dns.id}/exclusion",
            params: { excluded: true }, headers: other, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(ContentExclusion.count).to eq(0)
    end

    # 運営の見習い（operator）は工房に入れない。**役と権限は別**
    it "運営でも、工房の権限が無ければ書き換えられない" do
      operator = create(:user, :confirmed, role: "operator").create_new_auth_token

      patch "/api/v1/admin/studio/items/#{dns.id}/exclusion",
            params: { excluded: true }, headers: operator, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(ContentExclusion.count).to eq(0)
    end

    # **公式宮殿の外のカードは触らせない。** id を差し替えても届かない
    it "よその宮殿のカードは書き換えられない" do
      outsider_item = create(:user, :confirmed).items.create!(
        title: "よそのカード", item_type: word, generation_status: "completed"
      )

      patch "/api/v1/admin/studio/items/#{outsider_item.id}/exclusion",
            params: { excluded: true }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(ContentExclusion.count).to eq(0)
    end

    it "工房に入れる人の操作は、記録に残る" do
      expect { exclude! }
        .to change { AdminAuditLog.where(action: "studio.item_exclusion").count }.by(1)

      log = AdminAuditLog.where(action: "studio.item_exclusion").last
      expect(log.actor_id).to eq(studio_user.id)
      expect(log.details["title"]).to eq("DNS")
    end
  end
end
