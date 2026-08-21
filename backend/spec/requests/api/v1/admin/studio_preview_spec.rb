# frozen_string_literal: true

require "rails_helper"

# 公式コンテンツの下見。**出す前に、受け取った人と同じ画面で見る。**
#
# 自分のアカウントに入れて見るので、形は受け取りと同じになる。
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
    it "自分のアカウントに入って、開く先が返る" do
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

    # **公式の宮殿には手を出さない。** 消えるのは自分のアカウントに入れた複製だけ
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

  # ── 作った時点で固まっている ──────────────────
  #
  # **下見は、押した瞬間の姿を見るもの。**
  # 見ている最中に原本を直したら中身が変わる、では確かめたことにならない。
  # 直した姿を見たいなら、下見を作り直す
  describe "作った時点で固まっている" do
    before { start_preview }

    def preview_titles
      ids = ContentInstallation.find_by(source: "preview")
                               .entries.where(record_type: "Item").pluck(:record_id)
      Item.where(id: ids).pluck(:title).sort
    end

    it "原本のカードを直しても、下見は変わらない" do
      official.items.find_by(title: "DNS").update!(title: "DNS（直した）")

      expect(preview_titles).to eq(%w[DNS ルーター])
    end

    it "原本にカードを足しても、下見は増えない" do
      box = official.boxes.first
      item = official.items.create!(title: "あとから足した", item_type: word,
                                    generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "x.png", content_type: "image/png")
      item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: 9)

      expect(preview_titles).to eq(%w[DNS ルーター])
    end

    it "原本のカードを消しても、下見は欠けない" do
      official.items.find_by(title: "ルーター").destroy!

      expect(preview_titles).to eq(%w[DNS ルーター])
    end

    # 下書きを作り直しても、いま見ているものは変わらない
    it "下書きを作り直しても、下見は変わらない" do
      official.items.find_by(title: "DNS").update!(title: "DNS（直した）")
      ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: ContentPackages::Exporter.call(boxes: [ official.boxes.first ]))

      expect(preview_titles).to eq(%w[DNS ルーター])
    end

    # **ずれていることは伝える。**
    # 「直したのに変わらない」と見えたままにしない。
    #
    # ずれるのは下書きだけ。`draft!` は作り直すたびに行ごと入れ替わるので、
    # 生まれた時刻で見分けられる
    it "下見中の下書きが作り直されたら、そうと分かる" do
      draft = ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                                    payload: package.payload)
      start_preview(version: draft.version)

      get "/api/v1/admin/studio/preview", headers: headers, as: :json
      expect(json_response["status"]).to eq("draft")
      expect(json_response["stale"]).to be(false)

      # 同じ鍵の下書きは作り直される（版の番号も同じところへ戻る）
      travel_to(1.minute.from_now) do
        ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                              payload: package.payload)
      end

      get "/api/v1/admin/studio/preview", headers: headers, as: :json
      expect(json_response["stale"]).to be(true)
    end

    # 別の版の下書きを起こしても、いま見ている版には関わりが無い
    it "別の版が起こされても、いま見ている版はずれない" do
      ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: package.payload)

      get "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(json_response["stale"]).to be(false)
    end

    # 出したものは中身が変わらない決まりなので、ずれようがない
    it "出しているものの下見は、ずれない" do
      get "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(json_response["status"]).to eq("published")
      expect(json_response["stale"]).to be(false)
    end

    it "作り直せば、直した姿になる" do
      official.items.find_by(title: "DNS").update!(title: "DNS（直した）")
      newer = ContentPackage.publish!(
        key: "starter_it", kind: "starter", name: "ITのことば",
        payload: ContentPackages::Exporter.call(boxes: [ official.boxes.first ])
      )

      start_preview(version: newer.version)

      expect(preview_titles).to eq([ "DNS（直した）", "ルーター" ])
    end
  end

  # ── 下見のカードだと分かる ──────────────────
  #
  # 下見は自分のアカウントに入るので、見た目が本物と変わらない。
  # 印が無いと、自分で作ったカードと混ざる
  describe "下見のカードに付く印" do
    it "下見で入ったカードには印が付く" do
      start_preview

      get "/api/v1/items", headers: auth_headers_for(studio_user), as: :json

      rows = (json_response["items"] || json_response)
      expect(rows).not_to be_empty
      expect(rows.map { |i| i["from_preview"] }).to all(be(true))
    end

    it "詳細にも印が付く" do
      start_preview
      item = studio_user.items.first

      get "/api/v1/items/#{item.id}", headers: auth_headers_for(studio_user), as: :json

      expect(json_response["from_preview"]).to be(true)
    end

    # **自分で作ったカードには付かない。** 混ぜたら印の意味が無くなる
    it "自分で作ったカードには付かない" do
      mine = studio_user.items.create!(title: "自分のカード", item_type: word,
                                       generation_status: "completed")
      start_preview

      get "/api/v1/items/#{mine.id}", headers: auth_headers_for(studio_user), as: :json

      expect(json_response["from_preview"]).to be(false)
    end

    # **ふつうの利用者のカードには、絶対に付かない**
    it "工房に入れない人のカードには付かない" do
      outsider = create(:user, :confirmed)
      outsider.items.create!(title: "よそのカード", item_type: word, generation_status: "completed")

      get "/api/v1/items", headers: auth_headers_for(outsider), as: :json

      rows = (json_response["items"] || json_response)
      expect(rows.map { |i| i["from_preview"] }).to all(be(false))
    end

    # デルフォイで受け取ったカードは本物。**印は付かない**
    it "受け取ったカードには付かない" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      receiver = create(:user, :confirmed)
      ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "delphi")

      get "/api/v1/items", headers: auth_headers_for(receiver), as: :json

      rows = (json_response["items"] || json_response)
      expect(rows).not_to be_empty
      expect(rows.map { |i| i["from_preview"] }).to all(be(false))
    end

    # 下見を終えたら、印もカードも残らない
    it "終えたあとは残らない" do
      start_preview
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json

      get "/api/v1/items", headers: auth_headers_for(studio_user), as: :json

      expect((json_response["items"] || json_response)).to be_empty
    end
  end

  # ── 原本を汚さない ────────────────────────
  #
  # **公式のアカウントで下見すると、複製が公式宮殿そのものに入る。**
  # 名前まで同じなので、選ぶ画面では見分けが付かない。
  # そのまま並べると、下見の複製から公式コンテンツを作ってしまえる。
  #
  # 本番で実際に起きていた（公式宮殿にカード 74 → 124、同名の箱が2つずつ）。
  describe "公式のアカウントが自分で下見したとき" do
    let(:headers) { official.create_new_auth_token }

    before { start_preview }

    it "下見の複製は、原本として選べない" do
      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      names = json_response["boxes"].map { |b| b["name"] }
      expect(names).to eq([ "starter_it の箱" ])
      expect(official.boxes.count).to eq(2)
    end

    it "下見の複製は、カード一覧にも出ない" do
      get "/api/v1/admin/studio/items", headers: headers, as: :json

      titles = json_response["items"].map { |i| i["title"] }
      expect(titles).to contain_exactly("DNS", "ルーター")
      expect(official.items.count).to eq(4)
    end

    # **画面から外すだけでは足りない。** id を直に送れば通ってしまう
    it "下見の複製の id を直に送っても、荷物にならない" do
      copy = official.boxes.order(:created_at).last

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_new", kind: "starter", name: "新しい", box_ids: [ copy.id ] },
           headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to match(/1つ以上選/)
    end

    it "本物の箱は、これまでどおり選べる" do
      original = official.boxes.order(:created_at).first

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_new", kind: "starter", name: "新しい", box_ids: [ original.id ] },
           headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response["package"]["counts"]["items"]).to eq(2)
    end

    it "下見を終えれば、宮殿は元どおり" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json

      expect(official.reload.items.count).to eq(2)
      expect(official.boxes.count).to eq(1)
    end

    # **下見だけの話ではない。** デルフォイで受け取っても同じことが起きる。
    # 本番で実際に起きた（`studio@` が自分の荷物を受け取り、箱が2つ並んだ）
    it "デルフォイで受け取った複製も、原本として選べない" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      ContentPackages::Distributor.call(user: official, key: "starter_it", source: "delphi")

      expect(official.reload.boxes.count).to eq(2)

      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(json_response["boxes"].size).to eq(1)
      expect(json_response["boxes"].first["name"]).to eq("starter_it の箱")
    end

    it "受け取った複製の id を直に送っても、荷物にならない" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      ContentPackages::Distributor.call(user: official, key: "starter_it", source: "delphi")
      copy = official.reload.boxes.order(:created_at).last

      post "/api/v1/admin/studio/draft",
           params: { key: "starter_new", kind: "starter", name: "新しい", box_ids: [ copy.id ] },
           headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "受け取った複製は、カード一覧にも出ない" do
      delete "/api/v1/admin/studio/preview", headers: headers, as: :json
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      ContentPackages::Distributor.call(user: official, key: "starter_it", source: "delphi")

      get "/api/v1/admin/studio/items", headers: headers, as: :json

      expect(json_response["items"].map { |i| i["title"] }).to contain_exactly("DNS", "ルーター")
    end

    # 寿命が切れていても、掃除が回るまで実体は残っている。**その間も外す**
    it "寿命が切れていても、原本には混ざらない" do
      ContentInstallation.where(source: "preview")
                         .update_all(installed_at: Studio::Preview::LIFETIME.ago - 1.minute)

      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(json_response["boxes"].size).to eq(1)
    end
  end

  # 工房に入れる運営が下見しても、公式宮殿は何も変わらない
  describe "公式ではない人が下見したとき" do
    before { start_preview }

    it "公式宮殿は増えない" do
      expect(official.items.count).to eq(2)
      expect(official.boxes.count).to eq(1)
    end

    it "原本の一覧も変わらない" do
      get "/api/v1/admin/studio/sources", headers: headers, as: :json

      expect(json_response["boxes"].size).to eq(1)
    end
  end

  # ── さっと見る ───────────────────────────
  #
  # 「下見する」は自分の宮殿へ実際に入れるので、受け取った人と同じ画面で見られる。
  # だがカードを作って消す往復が要る。**見た目だけ確かめたいことのほうが多い。**
  describe "さっと見る" do
    it "何も作らずに、中身を返す" do
      expect {
        get "/api/v1/admin/studio/#{package.key}/#{package.version}/quick_look",
            headers: headers, as: :json
      }.not_to change(Item, :count)

      expect(response).to have_http_status(:success)
      expect(json_response["items"].map { |i| i["title"] }).to contain_exactly("DNS", "ルーター")
    end

    it "受け取りの記録も作らない" do
      expect {
        get "/api/v1/admin/studio/#{package.key}/#{package.version}/quick_look",
            headers: headers, as: :json
      }.not_to change(ContentInstallation, :count)
    end

    it "箱とキャンバスの様子も返す" do
      get "/api/v1/admin/studio/#{package.key}/#{package.version}/quick_look",
          headers: headers, as: :json

      box = json_response["boxes"].first
      expect(box["name"]).to eq("starter_it の箱")
      expect(box["count"]).to eq(2)
    end

    # **絵が出ないと、見た目を確かめる意味が無い**
    it "絵の在りかを返す" do
      get "/api/v1/admin/studio/#{package.key}/#{package.version}/quick_look",
          headers: headers, as: :json

      expect(json_response["items"].map { |i| i["image_url"] }).to all(be_present)
    end

    it "下書きも見られる" do
      draft = ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                                    payload: package.payload)

      get "/api/v1/admin/studio/starter_it/#{draft.version}/quick_look", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["status"]).to eq("draft")
    end

    it "工房に入れない人は見られない" do
      get "/api/v1/admin/studio/#{package.key}/#{package.version}/quick_look",
          headers: create(:user, :confirmed).create_new_auth_token, as: :json

      expect(response).to have_http_status(:forbidden)
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

    # **下見は自分のアカウントの中にしか無い。** ほかの人からは見えようがない
    it "下見で入ったカードは、その人の宮殿にしか無い" do
      start_preview
      other = create(:user, :confirmed)

      get "/api/v1/items", headers: auth_headers_for(other), as: :json

      titles = (json_response["items"] || json_response).map { |i| i["title"] }
      expect(titles).to be_empty
    end
  end
end
